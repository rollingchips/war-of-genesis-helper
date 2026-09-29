/**
 * War of Genesis Idle Loot — LiveSync Bridge v3.1
 * Đọc user_save_profile_enriched.json và expose qua WebSocket ws://127.0.0.1:10998
 * Hỗ trợ hàng đợi lệnh (Sequential Command Queue) & thực thi Lò Rèn / Kho Ngọc in-game.
 *
 * Cách dùng: node livesync_bridge.js
 * Yêu cầu: Node.js 16+ (không cần cài thêm package)
 */

const http  = require('http');
const https = require('https');
const net   = require('net');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

const PORT = 10998;
const LOCAL_DIR = __dirname;
const APPDATA_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'AppData/LocalLow/Newnormal Soft/War of Genesis Idle Loot'
);

function getCandidateDirs() {
  const dirs = [];
  if (APPDATA_DIR && fs.existsSync(APPDATA_DIR)) dirs.push(APPDATA_DIR);
  if (LOCAL_DIR && !dirs.includes(LOCAL_DIR) && fs.existsSync(LOCAL_DIR)) dirs.push(LOCAL_DIR);
  return dirs;
}

function resolveProfileFile() {
  const dirs = getCandidateDirs();
  let bestEnriched = null;
  let bestMtime = 0;
  for (const dir of dirs) {
    const p = path.join(dir, 'user_save_profile_enriched.json');
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.mtimeMs > bestMtime) {
          bestMtime = stat.mtimeMs;
          bestEnriched = p;
        }
      } catch(_) {}
    }
  }
  if (bestEnriched) return bestEnriched;

  for (const dir of dirs) {
    const p = path.join(dir, 'user_save_profile.json');
    if (fs.existsSync(p)) return p;
  }
  return path.join(APPDATA_DIR, 'user_save_profile_enriched.json');
}

const POLL_INTERVAL_MS = 2000; // push update mỗi 2 giây

// ── Màu ANSI ────────────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', red:'\x1b[31m', gray:'\x1b[90m' };
const log = (msg, color=C.cyan) => console.log(`${color}[Bridge]${C.reset} ${msg}`);

// ── Đọc profile từ disk (Hỗ trợ Universal AppData & Game Dir) ─────────────────
function readProfile() {
  try {
    const file = resolveProfileFile();
    if (!fs.existsSync(file)) return null;
    const raw  = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    data.isLiveConnected  = true;
    data.liveSyncSource   = 'game_hook_v3';
    data.exportedAt       = data.exportedAt || Date.now();
    return data;
  } catch (e) {
    return null;
  }
}

// ── WebSocket handshake (RFC 6455) ───────────────────────────────────────────
function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const accept = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return true;
}

// ── Encode WebSocket text frame (RFC 6455) ────────────────────────────────────
function wsSend(socket, text) {
  if (!socket || socket.destroyed) return;
  const payload = Buffer.from(text, 'utf8');
  const len     = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch(_) {}
}

// ── Decode incoming WS frame ────────────────────────────────────────────────
function wsDecode(buf) {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  const minLen = offset + (masked ? 4 : 0) + payloadLen;
  if (buf.length < minLen) return null;

  if (!masked) return buf.slice(offset, offset + payloadLen).toString('utf8');
  const mask = buf.slice(offset, offset + 4);
  offset += 4;
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) data[i] = buf[offset + i] ^ mask[i % 4];
  return data.toString('utf8');
}

// ── CDP-compatible response ─────────────────────────────────────────────────
function buildCdpResponse(id, profileData) {
  const valueJson = (typeof profileData === 'string') ? profileData : JSON.stringify(profileData);
  return JSON.stringify({
    id: id || 1,
    result: {
      result: {
        type: 'string',
        value: valueJson
      }
    }
  });
}

// ── Danh sách clients kết nối ─────────────────────────────────────────────────
const clients = new Set();
let lastProfileJson = '';

function pushUpdate(profileData) {
  const json = JSON.stringify(profileData);
  if (json === lastProfileJson) return;
  lastProfileJson = json;
  const msg = buildCdpResponse(1, profileData);
  let count = 0;
  for (const socket of clients) {
    wsSend(socket, msg);
    count++;
  }
}

// ── Sequential In-Game Command Queue (Universal Multi-Dir IPC) ──────────────────
const evalQueue = [];
let isQueueBusy = false, actionBlocked = false;
let ipcSequence = 0;
const ipcSession = crypto.randomBytes(12).toString('hex');
function writePendingEval(payload) {
  const dirs = getCandidateDirs();
  for (const dir of dirs) {
    try {
      fs.writeFileSync(path.join(dir, 'pending_eval.json'), payload, 'utf8');
    } catch(_) {}
  }
}

function checkAndClearResultFile() {
  const dirs = getCandidateDirs();
  for (const dir of dirs) {
    const resPath = path.join(dir, 'eval_result.json');
    if (fs.existsSync(resPath)) {
      try {
        const raw = fs.readFileSync(resPath, 'utf8');
        fs.unlinkSync(resPath);
        const data = JSON.parse(raw);
        if (data) return data;
      } catch(_) {}
    }
  }
  return null;
}

function cleanupPendingFiles() {
  const dirs = getCandidateDirs();
  for (const dir of dirs) {
    try {
      const p = path.join(dir, 'pending_eval.json');
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch(_) {}
    try {
      const r = path.join(dir, 'eval_result.json');
      if (fs.existsSync(r)) fs.unlinkSync(r);
    } catch(_) {}
  }
}


function transportFault(socket,id,reason) {
  wsSend(socket,buildCdpResponse(id,{action:'workshopTransport',success:false,uncertain:true,code:'WORKSHOP_TRANSPORT_UNCERTAIN',reason}));
}
function enqueueEvalCommand(reqId, code, socket) {
  if(actionBlocked){transportFault(socket,reqId,'Bridge action result uncertain; check the game before restarting LiveSync.');return;}
  evalQueue.push({id:reqId,code,socket,queuedAt:Date.now()});
  processNextInQueue();
}
function processNextInQueue() {
  if(isQueueBusy||actionBlocked||!evalQueue.length)return;
  const item=evalQueue.shift();
  // A queued action must not start after its browser receipt deadline approaches.
  if(Date.now()-item.queuedAt>1000){
    transportFault(item.socket,item.id,'Bridge queue delay; command not submitted. Check the game before restarting LiveSync.');
    actionBlocked=true;
    for(const queued of evalQueue.splice(0))transportFault(queued.socket,queued.id,'Bridge paused; queued command not submitted.');
    return;
  }
  isQueueBusy=true;
  const ipcId=ipcSession+'-'+(++ipcSequence);
  let pollInterval;
  function fail(reason) {
    clearInterval(pollInterval);actionBlocked=true;isQueueBusy=false;
    // Do not delete an uncertain in-flight command or claim it was cancelled.
    transportFault(item.socket,item.id,reason);
    for(const queued of evalQueue.splice(0))transportFault(queued.socket,queued.id,'Bridge paused; queued command not submitted.');
  }
  try {
    cleanupPendingFiles();
    writePendingEval(JSON.stringify({id:ipcId,code:item.code}));
    const started=Date.now();
    pollInterval=setInterval(()=>{
      try {
        const data=checkAndClearResultFile();
        if(data&&data.id===ipcId){
          if(data.error||data.result==null){fail('Game action returned no usable receipt. Check the game before restarting LiveSync.');return;}
          clearInterval(pollInterval);
          wsSend(item.socket,buildCdpResponse(item.id,data.result));
          isQueueBusy=false;setImmediate(processNextInQueue);return;
        }
        if(Date.now()-started>=12000)fail('Bridge action timed out. Check the game before restarting LiveSync.');
      }catch(_){fail('Bridge receipt read failed. Check the game before restarting LiveSync.');}
    },20);
  }catch(_){fail('Bridge action dispatch failed. Check the game before restarting LiveSync.');}
}

// ── Steam Community Market Query Engine ──────────────────────────────────────
function fetchHttps(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

async function querySteamMarket(sQuery) {
  const query = (sQuery || '').trim();
  const isJewelQuery = (query.toLowerCase() === 'jewel' || query.toLowerCase() === 'ngọc');
  const sItems = {};
  let totalFound = 0;
  const maxPages = isJewelQuery ? 6 : (query ? 3 : 6);

  for (let p = 0; p < maxPages; p++) {
    const startIdx = p * 10;
    let marketUrl = '';
    if (isJewelQuery) {
      marketUrl = 'https://steamcommunity.com/market/search/render/?category_4891320_type%5B%5D=tag_jewel&start=' + startIdx + '&count=10&appid=4891320&norender=1';
    } else if (query) {
      marketUrl = 'https://steamcommunity.com/market/search/render/?query=' + encodeURIComponent(query) + '&start=' + startIdx + '&count=10&appid=4891320&norender=1';
    } else {
      marketUrl = 'https://steamcommunity.com/market/search/render/?start=' + startIdx + '&count=10&appid=4891320&norender=1';
    }

    const data = await fetchHttps(marketUrl);
    if (data && data.results && data.results.length > 0) {
      totalFound = data.total_count || totalFound;
      for (const r of data.results) {
        const itemName = r.name || r.hash_name;
        const sellPrice = r.sell_price || 0;
        const priceUsd = Math.round((sellPrice / 100.0) * 100) / 100;
        const listings = r.sell_listings || 0;
        sItems[itemName] = {
          name: itemName,
          price_usd: priceUsd,
          price_text: '$' + priceUsd.toFixed(2),
          listings: listings,
          isLive: true,
          updatedAt: Date.now()
        };
      }
      if (data.results.length < 10) break;
    } else {
      break;
    }
  }

  // Save to steam_market_prices.json in all available candidate dirs
  if (Object.keys(sItems).length > 0) {
    const dirs = getCandidateDirs();
    for (const d of dirs) {
      try {
        const pFile = path.join(d, 'steam_market_prices.json');
        let existing = {};
        if (fs.existsSync(pFile)) {
          try { existing = JSON.parse(fs.readFileSync(pFile, 'utf8')); } catch(_) {}
        }
        Object.assign(existing, sItems);
        fs.writeFileSync(pFile, JSON.stringify(existing, null, 2), 'utf8');
      } catch(_) {}
    }
  }

  return {
    query: query,
    total: totalFound || Object.keys(sItems).length,
    items: sItems
  };
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/json' || req.url === '/json/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      Browser: 'Genesis/LiveSync-Bridge/3.2',
      'Protocol-Version': '1.3',
      webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}`
    }));
    return;
  }

  if (req.url.startsWith('/api/steam-market')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let queryParam = '';
    try {
      const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
      queryParam = u.searchParams.get('query') || '';
    } catch(_) {}

    log(`🔎 [HTTP Steam Market] Query: "${queryParam}"`, C.cyan);
    querySteamMarket(queryParam).then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.toString() }));
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('LiveSync Bridge v3.2 — War of Genesis Idle Loot\n');
});

server.on('upgrade', (req, socket, head) => {
  if (!wsHandshake(req, socket)) return;

  log(`Client connected: ${socket.remoteAddress}`, C.green);
  clients.add(socket);

  let buf = Buffer.alloc(0);

  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    try {
      const text = wsDecode(buf);
      if (!text) return;
      buf = Buffer.alloc(0);

      let req_id = 1;
      let evalCode = '';
      try {
        const parsed = JSON.parse(text);
        req_id = parsed.id || 1;
        if (parsed.params && parsed.params.expression) {
          evalCode = parsed.params.expression;
        }
      } catch(_) {
        evalCode = text;
      }

      // Check if this is an interactive action command (Lò rèn / Kho ngọc / In-game)
      const isActionCmd = evalCode && (
        evalCode.includes('__runJewelAction') && !evalCode.includes('NetContainerUser')
      );

      // Check if this is a Steam Market query
      let steamQueryVal = null;
      if (evalCode) {
        const sqMatch = evalCode.match(/["']?steamQuery["']?\s*:\s*["']([^"']*)["']/);
        if (sqMatch && sqMatch[1] !== undefined && sqMatch[1] !== 'null') {
          steamQueryVal = sqMatch[1];
        }
      }

      if (isActionCmd) {
        // Enqueue into in-game execution queue
        log(`📥 [Action Enqueued] id=${req_id}`, C.cyan);
        enqueueEvalCommand(req_id, evalCode, socket);
      } else if (steamQueryVal !== null) {
        log(`🔎 [WS Steam Market] Query: "${steamQueryVal}" (id=${req_id})`, C.cyan);
        querySteamMarket(steamQueryVal).then(steamRes => {
          const profile = readProfile() || {};
          profile.liveSteamResults = steamRes;
          wsSend(socket, buildCdpResponse(req_id, profile));
        }).catch(err => {
          log(`⚠️ [WS Steam Market] Error: ${err.message}`, C.yellow);
          const profile = readProfile() || {};
          wsSend(socket, buildCdpResponse(req_id, profile));
        });
      } else {
        // Normal profile poll -> Instant response from memory/file without game IPC overhead!
        const profile = readProfile();
        if (profile) {
          wsSend(socket, buildCdpResponse(req_id, profile));
        }
      }
    } catch(decodeErr) {
      buf = Buffer.alloc(0);
    }
  });

  socket.on('close', () => { clients.delete(socket); });
  socket.on('error', () => { clients.delete(socket); });
});

// ── Polling & File Watcher ──────────────────────────────────────────────────
setInterval(() => {
  if (clients.size === 0) return;
  const profile = readProfile();
  if (profile) pushUpdate(profile);
}, POLL_INTERVAL_MS);

function watchFiles() {
  const watchFile = resolveProfileFile();
  if (!fs.existsSync(watchFile)) return;
  try {
    fs.watch(watchFile, { persistent: false }, (event) => {
      if (event === 'change') {
        setTimeout(() => {
          const profile = readProfile();
          if (profile) pushUpdate(profile);
        }, 100);
      }
    });
  } catch(_) {}
}

// ── Khởi động ─────────────────────────────────────────────────────────────────
server.listen(PORT, '127.0.0.1', () => {
  const activeFile = resolveProfileFile();
  const fileExists = fs.existsSync(activeFile);
  const locationTag = activeFile.includes('AppData') ? 'AppData Universal' : 'Game Folder';
  const fileLabel = fileExists ? `${path.basename(activeFile)} [${locationTag}]` : 'user_save_profile.json (Chờ game...)';

  console.log('');
  console.log(`${C.green}╔══════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.green}║   War of Genesis — LiveSync Bridge v3.2  ✅ ONLINE   ║${C.reset}`);
  console.log(`${C.green}╚══════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.cyan}  WebSocket : ws://127.0.0.1:${PORT}${C.reset}`);
  console.log(`${C.cyan}  Reading from: ${fileLabel}${C.reset}`);
  console.log(`${C.cyan}  Features: Automatic jewel fusion and storage ${C.reset}`);
  console.log('');

  const profile = readProfile();
  if (profile) {
    log(`✅ Profile found: ${profile.nickname} Lv.${profile.level} (CP: ${profile.combatPower})`, C.green);
    watchFiles();
  }
});

let retriedPort = false;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && !retriedPort) {
    retriedPort = true;
    log(`⚠️ Port ${PORT} is busy; stopping the previous process...`, C.yellow);
    try {
      const { execSync } = require('child_process');
      const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8' });
      const match = out.trim().split(/\s+/).pop();
      if (match && Number(match) > 0 && Number(match) !== process.pid) {
        execSync(`taskkill /PID ${match} /F`);
        log(`✅ Released port ${PORT} successfully!`, C.green);
      }
      setTimeout(() => {
        server.listen(PORT, '127.0.0.1');
      }, 600);
      return;
    } catch(e) {
      log(`❌ Could not release the port automatically: ${e.message}`, C.red);
    }
  } else {
    log(`❌ Server error: ${err.message}`, C.red);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  try { console.log('[Bridge Error Caught]', err.message); } catch(_) {}
});
process.on('unhandledRejection', (reason) => {
  try { console.log('[Bridge Rejection Caught]', reason); } catch(_) {}
});
