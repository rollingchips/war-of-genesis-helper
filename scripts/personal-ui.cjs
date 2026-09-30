const acorn=require('acorn');
function removeDiv(html,id){
 const tag=new RegExp('<div\\b[^>]*\\bid="'+id+'"[^>]*>','i').exec(html);
 if(!tag)throw Error('Missing personal UI removal anchor '+id);
 const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=tag.index;let depth=0,m;
 while((m=tags.exec(html))){depth+=m[0].startsWith('</')?-1:1;if(depth===0)return html.slice(0,tag.index).replace(/[ \t]+$/,'')+html.slice(tags.lastIndex);}
 throw Error('Unclosed UI block '+id);
}
function personalUI(html){
 html=require('./level-eta.cjs').patchLevelEta(html);
 for(const id of ['liveSyncDownloadCallout','jewelUpdateNoticeBanner','watchdogModal','updateNoticeModal'])html=removeDiv(html,id);
 // Remove help/update buttons but retain the connection status badge itself.
 html=html.replace(/^[ \t]*<button\b[^>]*onclick="(?:openLiveSyncHelpModal|openWatchdogModal|openUpdateNoticeModal)\([^"\n]*"[^>]*>[\s\S]*?<\/button>/gm,'');
 html=html.replace(/<div\b[^>]*id="wsStatusBadge"[^>]*>/,tag=>tag.replace(/\s+onclick="[^"]*"/,'').replace(/\s+title="[^"]*"/,'').replace('cursor:pointer;',''));
 html=html.replace(/text\.innerHTML = '[^\n]*onclick="openLiveSyncHelpModal\(\)"[^\n]*';/,"text.innerText = 'HTTPS 頁面無法連線至本機 Bridge';");
 const retired=new Set(['openWatchdogModal','closeWatchdogModal','openLiveSyncHelpModal','downloadLiveSyncBat','copyBatScript','copyWatchdogScript','openUpdateNoticeModal','closeUpdateNoticeModal','setUpdateNoticeLang']);
 return html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,js,close)=>{
  const edits=[];
  for(const n of acorn.parse(js,{ecmaVersion:'latest'}).body){
   if(n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='LIVESYNC_BAT_CONTENT'))edits.push([n.start,n.end,'']);
   if(n.type==='FunctionDeclaration'&&retired.has(n.id.name))edits.push([n.start,n.end,'']);
   if(n.type==='FunctionDeclaration'&&n.id.name==='checkAndShowUpdateNotice')edits.push([n.start,n.end,'function checkAndShowUpdateNotice() {}']);
  }
  for(const [a,b,text] of edits.sort((a,b)=>b[0]-a[0]))js=js.slice(0,a)+text+js.slice(b);
  return open+js+close;
 });
}
module.exports={personalUI};
