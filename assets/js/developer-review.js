/* Treasure Academy encrypted human-review gateway. No training approval is granted here. */
(function(){
'use strict';
var PAYLOAD_URL='assets/data/review-gateway.enc.json';
var STORE_KEY='treasure_review_gateway_progress_v1';
var DATA=null,PACKAGE_SHA='',state={reviews:{}},currentTrack='pilot_teacher',currentIndex=0,autosaveTimer=null;
function $(id){return document.getElementById(id)}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function b64(value){var raw=atob(value),out=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
function hex(buffer){return Array.prototype.map.call(new Uint8Array(buffer),function(v){return v.toString(16).padStart(2,'0')}).join('')}
function status(message,good){var el=$('status');el.textContent=message;el.className='status '+(good?'ok':'bad')}
function loadState(){try{var parsed=JSON.parse(localStorage.getItem(STORE_KEY)||'{"reviews":{}}');if(parsed&&parsed.reviews&&typeof parsed.reviews==='object')state=parsed}catch(e){state={reviews:{}}}}
function saveState(){state.updatedAt=new Date().toISOString();state.trainingApprovalGranted=false;localStorage.setItem(STORE_KEY,JSON.stringify(state))}
async function decrypt(passphrase){
  if(!(window.crypto&&crypto.subtle))throw new Error('This browser does not support secure decryption.');
  var response=await fetch(PAYLOAD_URL,{cache:'no-store'});if(!response.ok)throw new Error('Encrypted review package could not be loaded.');
  var payload=await response.json();if(payload.schema!=='treasure-encrypted-review-payload-v1'||payload.training_authorised!==false)throw new Error('Review package failed its safety check.');
  var material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(payload.salt_b64),iterations:payload.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  var plaintext;
  try{plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(payload.iv_b64),additionalData:b64(payload.aad_b64),tagLength:128},key,b64(payload.ciphertext_b64))}catch(e){throw new Error('Incorrect passphrase or damaged review package.');}
  var digest=await crypto.subtle.digest('SHA-256',plaintext);if(hex(digest)!==payload.plaintext_sha256)throw new Error('Decrypted review package hash mismatch.');
  var data=JSON.parse(new TextDecoder().decode(plaintext));if(data.schema!=='treasure-human-review-portal-v1'||data.trainingAuthorised!==false)throw new Error('Decrypted review package has an invalid schema.');
  PACKAGE_SHA=payload.plaintext_sha256;
  return data;
}
function entities(){var track=DATA.tracks[currentTrack];return DATA[track.entitySet]}
function ids(){return DATA.tracks[currentTrack].ids}
function keyFor(id){return currentTrack+':'+id}
function emptyReview(id){return{reviewerName:'',reviewerRole:DATA.tracks[currentTrack].requiredRole,reviewedAt:'',decision:'PENDING',notes:'',confirmed:false,contentSha256:entities()[id].hash}}
function getReview(id){return state.reviews[keyFor(id)]||emptyReview(id)}
function pruneStale(){var clean={};Object.keys(state.reviews).forEach(function(key){var cut=key.indexOf(':'),track=key.slice(0,cut),id=key.slice(cut+1),cfg=DATA.tracks[track],review=state.reviews[key];if(cfg&&cfg.ids.indexOf(id)>=0&&DATA[cfg.entitySet][id]&&review.contentSha256===DATA[cfg.entitySet][id].hash)clean[key]=review});state.reviews=clean;saveState()}
function fillTracks(){var select=$('track');select.innerHTML='';Object.keys(DATA.tracks).forEach(function(key){var o=document.createElement('option');o.value=key;o.textContent=DATA.tracks[key].label;select.appendChild(o)});select.value=currentTrack}
function filteredIds(){var query=$('search').value.trim().toLowerCase();return ids().filter(function(id){return !query||id.toLowerCase().indexOf(query)>=0||entities()[id].title.toLowerCase().indexOf(query)>=0})}
function fillList(){var list=filteredIds(),select=$('itemList');select.innerHTML='';list.forEach(function(id){var o=document.createElement('option');o.value=id;o.textContent=entities()[id].title;select.appendChild(o)});var active=ids()[Math.min(currentIndex,ids().length-1)];if(list.length&&list.indexOf(active)<0){active=list[0];currentIndex=ids().indexOf(active)}select.value=active||'';render()}
function progress(){var all=ids(),done=all.filter(function(id){return getReview(id).decision!=='PENDING'}).length;$('progressText').textContent=done+' / '+all.length+' reviewed';$('progressBar').style.width=(all.length?100*done/all.length:0)+'%'}
function metaHtml(rows){return rows.map(function(row){var label=esc(row[0]),value=String(row[1]==null?'':row[1]);if(/^https:\/\//.test(value))return'<div><strong>'+label+':</strong> <a href="'+esc(value)+'" target="_blank" rel="noopener noreferrer">Open exact source</a></div>';return'<div><strong>'+label+':</strong> '+esc(value)+'</div>'}).join('')}
function render(){
  if(!DATA)return;var all=ids();if(!all.length){$('reviewCard').innerHTML='<p>No review items.</p>';return}currentIndex=Math.max(0,Math.min(currentIndex,all.length-1));var id=all[currentIndex],entity=entities()[id],track=DATA.tracks[currentTrack],review=getReview(id);$('itemList').value=id;
  var prompts=track.prompts.map(function(p){return'<li>☐ '+esc(p)+'</li>'}).join('');
  var options=track.decisions.map(function(d){return'<option'+(d===review.decision?' selected':'')+'>'+esc(d)+'</option>'}).join('');
  var content=track.showContent?'<h3>Full text to review</h3><p class="small">This is the complete extracted training text. Scroll inside the box for long books.</p><div class="content">'+esc(entity.content)+'</div>':'<p class="small"><strong>This track reviews evidence and metadata. Choose a teacher or safeguarding track to read the complete text.</strong></p>';
  $('reviewCard').innerHTML='<h2>'+(currentIndex+1)+'. '+esc(entity.title)+'</h2><div class="meta">'+metaHtml(entity.metadata)+'</div><div class="prompts"><strong>Review prompts</strong><ul>'+prompts+'</ul></div>'+content+'<section class="form"><p><strong>Decision record:</strong> '+esc(track.recordFile)+'</p><div class="row"><div><label>Reviewer’s real name</label><input id="reviewerName" value="'+esc(review.reviewerName)+'"></div><div><label>Required role</label><input id="reviewerRole" value="'+esc(review.reviewerRole)+'" readonly></div><div><label>Review date</label><input id="reviewedAt" type="date" value="'+esc(review.reviewedAt)+'"></div></div><label>Decision</label><select id="decision">'+options+'</select><label>Notes and required corrections</label><textarea id="notes">'+esc(review.notes)+'</textarea><label class="confirm"><input id="confirmed" type="checkbox"'+(review.confirmed?' checked':'')+'><span>I confirm that I am the named human reviewer, genuinely hold the stated role, and reviewed this exact SHA-256 item. This is not final training approval.</span></label><div class="nav"><button class="secondary" id="previous">← Previous</button><button id="saveReview">Save review</button><button class="secondary" id="next">Next →</button></div></section>';
  $('previous').onclick=function(){move(-1)};$('next').onclick=function(){move(1)};$('saveReview').onclick=saveCurrent;
  ['reviewerName','reviewedAt','decision','notes','confirmed'].forEach(function(field){$(field).addEventListener(field==='reviewerName'||field==='notes'?'input':'change',queueAutosave)});
  progress();status('Viewing '+(currentIndex+1)+' of '+all.length+': '+id,true)
}
function move(delta){currentIndex=Math.max(0,Math.min(ids().length-1,currentIndex+delta));render()}
function formReview(){var id=ids()[currentIndex];return{reviewerName:$('reviewerName').value.trim(),reviewerRole:$('reviewerRole').value.trim(),reviewedAt:$('reviewedAt').value,decision:$('decision').value,notes:$('notes').value.trim(),confirmed:$('confirmed').checked,contentSha256:entities()[id].hash,savedAt:new Date().toISOString()}}
function queueAutosave(){var id=ids()[currentIndex];state.reviews[keyFor(id)]=formReview();saveState();progress();status('Draft autosaved on this device.',true)}
function reviewError(track,id,review){
  if(!review||track.ids.indexOf(id)<0)return'Unknown review item.';
  if(track.decisions.indexOf(review.decision)<0)return'Invalid decision for '+id+'.';
  if(review.reviewerRole!==track.requiredRole)return'Reviewer role does not match '+id+'.';
  if(review.contentSha256!==DATA[track.entitySet][id].hash)return'Content hash does not match '+id+'.';
  if(review.decision!=='PENDING'){
    if(!review.reviewerName||!review.reviewedAt||!review.confirmed)return'A non-pending decision requires a real name, date and confirmation for '+id+'.';
    if(['CHANGES_REQUIRED','REJECTED','NOT_CLEARED','MORE_INFORMATION_REQUIRED'].indexOf(review.decision)>=0&&!review.notes)return'The decision for '+id+' requires explanatory notes.';
  }
  return'';
}
function saveCurrent(){
  clearTimeout(autosaveTimer);var id=ids()[currentIndex],track=DATA.tracks[currentTrack],review=formReview(),error=reviewError(track,id,review);
  if(error){state.reviews[keyFor(id)]=review;saveState();progress();status(error+' Draft was autosaved, but cannot be submitted or exported yet.',false);return}
  state.reviews[keyFor(id)]=review;saveState();progress();status('Saved and validated on this device. Export after completing the batch.',true)
}
function validateAll(){Object.keys(state.reviews).forEach(function(key){var cut=key.indexOf(':'),trackKey=key.slice(0,cut),id=key.slice(cut+1),track=DATA.tracks[trackKey];if(!track)throw new Error('Unknown track in saved progress.');var error=reviewError(track,id,state.reviews[key]);if(error)throw new Error(error)})}
function exportObject(){validateAll();return{schema:'treasure-human-review-export-v1',portalSchema:DATA.schema,packagePlaintextSha256:PACKAGE_SHA,exportedAt:new Date().toISOString(),branch:'preview',trainingApprovalGranted:false,reviews:Object.keys(state.reviews).sort().map(function(key){var cut=key.indexOf(':');return Object.assign({track:key.slice(0,cut),itemId:key.slice(cut+1)},state.reviews[key])})}}
function exportText(){try{var text=JSON.stringify(exportObject(),null,2);$('exportText').value=text;$('exportArea').classList.remove('hidden');status('Export ready. Download, copy or share it with the project owner.',true);return text}catch(e){status('Export blocked: '+e.message,false);return null}}
function exportFile(){var text=exportText();return text===null?null:new File([text],'treasure-review-export.json',{type:'application/json'})}
function download(){var file=exportFile();if(!file)return;var url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)}
async function copy(){var text=exportText();if(text===null)return;try{await navigator.clipboard.writeText(text);status('Export copied.',true)}catch(e){$('exportText').focus();$('exportText').select();status('Clipboard permission was blocked. Use Download or Share instead.',false)}}
async function share(){var file=exportFile();if(!file)return;try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:'Treasure review export',text:'Completed Treasure Academy review batch.',files:[file]});status('Share sheet opened.',true)}else if(navigator.share){await navigator.share({title:'Treasure review export',text:$('exportText').value});status('Share sheet opened.',true)}else throw new Error('not-supported')}catch(e){if(e.name!=='AbortError')status('Sharing is not supported here. Use Download or Copy.',false)}}
function importExport(obj){
  if(!obj||obj.schema!=='treasure-human-review-export-v1'||obj.trainingApprovalGranted!==false||!Array.isArray(obj.reviews))throw new Error('Wrong export format');
  if(obj.packagePlaintextSha256!==PACKAGE_SHA)throw new Error('Export belongs to a different review-package version');
  obj.reviews.forEach(function(review){var track=DATA.tracks[review.track];if(!track||track.ids.indexOf(review.itemId)<0)throw new Error('Unknown track or item: '+review.itemId);var error=reviewError(track,review.itemId,review);if(error)throw new Error(error)});
  obj.reviews.forEach(function(review){var copy=Object.assign({},review);delete copy.track;delete copy.itemId;state.reviews[review.track+':'+review.itemId]=copy});saveState();render();status('Imported '+obj.reviews.length+' validated review record(s).',true)
}
function bind(){
  $('track').onchange=function(){currentTrack=this.value;currentIndex=0;$('search').value='';fillList()};$('search').oninput=fillList;$('itemList').onchange=function(){currentIndex=ids().indexOf(this.value);render()};
  $('exportButton').onclick=exportText;$('exportTop').onclick=exportText;$('downloadButton').onclick=download;$('copyButton').onclick=copy;$('shareButton').onclick=share;$('importButton').onclick=function(){$('importFile').click()};
  $('importFile').onchange=function(){var file=this.files&&this.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){try{importExport(JSON.parse(reader.result))}catch(e){status('Import failed: '+e.message,false)}};reader.readAsText(file)};
  $('clearButton').onclick=function(){if(confirm('Delete all locally saved review progress on this device?')){state={reviews:{}};saveState();render()}};
  $('developerConsole').onclick=function(){location.href='developer.html'};
  $('lockButton').onclick=function(){clearTimeout(autosaveTimer);DATA=null;PACKAGE_SHA='';$('reviewCard').textContent='Locked.';$('itemList').innerHTML='';$('track').innerHTML='';$('exportText').value='';$('exportArea').classList.add('hidden');$('reviewApp').classList.add('hidden');$('reviewGate').classList.remove('hidden');$('passphrase').value='';$('unlockStatus').textContent='';$('passphrase').focus()}
}
$('unlockForm').onsubmit=async function(event){event.preventDefault();var button=$('unlockButton'),message=$('unlockStatus'),passphrase=$('passphrase').value;button.disabled=true;message.textContent='Decrypting the private review package…';try{DATA=await decrypt(passphrase);passphrase='';$('passphrase').value='';loadState();pruneStale();fillTracks();bind();$('reviewGate').classList.add('hidden');$('reviewApp').classList.remove('hidden');fillList();message.textContent=''}catch(e){message.textContent=e.message;DATA=null;PACKAGE_SHA=''}finally{passphrase='';button.disabled=false}};
})();
