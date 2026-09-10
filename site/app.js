'use strict';
const byId=id=>document.getElementById(id);
const canvas=byId('canvas');
let started=false;
const realFetch=window.fetch.bind(window);
const appBase=new URL('./',window.location.href);
// ScummVM uses virtual /data paths. Keep HTTP requests within this Pages project.
window.fetch=(input,init)=>{
 const url=new URL(input instanceof Request ? input.url : input,appBase);
 if(url.origin===appBase.origin && (url.pathname==='/data'||url.pathname.startsWith('/data/'))){
  const target=new URL(url.pathname.slice(1)+url.search,appBase);
  return realFetch(input instanceof Request ? new Request(target,input) : target.href,init);
 }
 return realFetch(input,init);
};
async function enableAudio(){
 const contexts=[window.Module?.SDL3?.audioContext,window.Module?.SDL2?.audioContext,window.Module?.AL?.currentCtx?.audioCtx].filter(Boolean);
 try{await Promise.all(contexts.map(ctx=>ctx.state==='suspended'?ctx.resume():Promise.resolve()));
  byId('sound').textContent=contexts.some(ctx=>ctx.state==='running')?'Sound enabled':'Enable sound';
 }catch{byId('sound').textContent='Try enabling sound again'}
}
byId('sound').onclick=()=>{enableAudio();canvas.focus()};
canvas.addEventListener('pointerdown',enableAudio);
const controls=byId('controls');
byId('help').onclick=()=>controls.showModal();
for(const b of document.querySelectorAll('.close'))b.onclick=()=>{controls.close();if(started)canvas.focus()};
byId('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await byId('stage').requestFullscreen();canvas.focus()}catch{byId('fullscreen').textContent='Fullscreen unavailable'}};
function fail(message){byId('download-modal').hidden=true;byId('error-text').textContent=message;byId('error-panel').hidden=false;byId('menu').disabled=true;}
function status(text){const el=byId('download-modal');el.hidden=!text;if(text){el.style.display='block';byId('download-modal-title').firstElementChild.textContent=text}}
function sendKey(key,code,keyCode){canvas.focus();for(const type of ['keydown','keyup']){const event=new KeyboardEvent(type,{key,code,keyCode,which:keyCode,bubbles:true,cancelable:true});canvas.dispatchEvent(event)}}
byId('menu').onclick=()=>sendKey('F5','F5',116);
window.addEventListener('keydown',event=>{if(started&&event.key==='F5')event.preventDefault()},{capture:true});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The graphics connection was lost. Reload the page, then load your last saved game.')});
window.addEventListener('error',e=>{if(started&&/scummvm|app\.js/.test(e.filename||''))fail('The game encountered an error. Reload to try again, then load your last saved game.');});
window.Module={
 canvas,
 preRun:[],postRun:[],
 print:(...args)=>console.log(...args),
 printErr:(...args)=>console.error(...args),
 setStatus:status,
 onAbort:()=>fail('The game engine could not start. Please reload and try again in a current desktop browser.'),
 onRuntimeInitialized:()=>{status('Starting Beneath a Steel Sky…');byId('menu').disabled=false;byId('sound').disabled=false;canvas.focus()},
 onExit:()=>{byId('menu').disabled=true;fail('The game has closed. Reload to play again; use the game menu to load a saved game.')}
};
byId('play').onclick=async()=>{
 if(started)return;
 if(location.protocol==='file:'){
  byId('start-screen').hidden=true;
  fail('This game needs a web server. Opening index.html directly with file:// blocks its downloads. Upload the built site folder contents to your website, or run a local web server and open its http://localhost address. See README.md for local-server instructions.');
  return;
 }
 started=true;byId('start-screen').hidden=true;status('Loading the game engine…');
 try{
  // Set the target before loading the unmodified ScummVM web shell, which
  // obtains its launch arguments from the URL fragment.
  history.replaceState(null,'',location.pathname+location.search+'#--path=/data/games/sky-cd --language=en --subtitles --speech-volume=255 sky:sky');
  const manifestResponse=await realFetch('engine/manifest.json');
  if(!manifestResponse.ok)throw Error('The download manifest could not be loaded.');
  const manifest=await manifestResponse.json();
  const total=manifest.reduce((n,p)=>n+p.size,0);let downloaded=0;
  const chunks=await Promise.all(manifest.map(async part=>{
   const response=await realFetch(part.url);if(!response.ok)throw Error('A game-engine download failed.');
   const reader=response.body.getReader();const chunks=[];let bytes=0;
   while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.byteLength;downloaded+=value.byteLength;
    byId('download-modal-progress-fill').style.width=(100*downloaded/total)+'%';
    byId('download-modal-progress-text').textContent=`${(downloaded/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB`;
   }
   if(bytes!==part.size)throw Error('The game-engine download was incomplete.');
   const result=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}return result;
  }));
  const binary=new Uint8Array(total);let offset=0;for(const chunk of chunks){binary.set(chunk,offset);offset+=chunk.length}
  window.Module.instantiateWasm=(imports,receiveInstance)=>WebAssembly.instantiate(binary,imports).then(result=>{receiveInstance(result.instance,result.module);return result.instance.exports}).catch(error=>{fail('The game engine could not be initialized: '+error.message);throw error});
  status('Starting the game engine…');
  const script=document.createElement('script');script.src='scummvm.js';script.onerror=()=>fail('The game engine could not be downloaded. Check your connection and try again.');document.body.append(script);
 }catch(e){fail(e instanceof TypeError ? 'The browser could not download a required game file. Check your connection and that the complete built site folder is being served over HTTP or HTTPS. See the browser console for the failed request.' : (e.message||'The game could not be downloaded. Please try again.'))}
};
