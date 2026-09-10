import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'_site');
for(const file of ['app.js','scummvm.js'])execFileSync(process.execPath,['--check',path.join(out,file)]);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'engine/manifest.json')));
const wasm=Buffer.concat(manifest.map(part=>{const b=fs.readFileSync(path.join(out,part.url));assert.equal(b.length,part.size);return b}));
assert(WebAssembly.validate(wasm),'Invalid engine');
assert(WebAssembly.validate(fs.readFileSync(path.join(out,'data/plugins/libsky.so'))),'Invalid Sky plugin');
function checkIndexes(dir){
 const idx=JSON.parse(fs.readFileSync(path.join(dir,'index.json')));
 for(const [name,size] of Object.entries(idx)){
  const f=path.join(dir,name);
  if(typeof size==='object')checkIndexes(f);else assert.equal(fs.statSync(f).size,size,f);
 }
}
checkIndexes(path.join(out,'data'));
const config=fs.readFileSync(path.join(out,'scummvm.ini'),'utf8');
assert(config.includes('speech_mute=false')&&config.includes('subtitles=true'));
assert(config.includes('path=/data/games/sky-cd'));
assert.equal(fs.statSync(path.join(out,'data/games/sky-cd/sky.dsk')).size,72429382);
const app=fs.readFileSync(path.join(out,'app.js'),'utf8');
for(const base of ['https://southernadd-cmyk.github.io/bass/','http://localhost:8000/']){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{addEventListener(){},focus(){}});return elements.get(id)};
 const calls=[];
 const loc=new URL(base);
 const window={location:loc,fetch:async(input,init)=>{calls.push({input,init});return {}},addEventListener(){}};
 const context=vm.createContext({window,location:loc,document:{getElementById:get,querySelectorAll:()=>[]},URL,Request,console,Uint8Array,WebAssembly});
 vm.runInContext(app,context);
 await window.fetch('/data/index.json');
 assert.equal(calls.at(-1).input,new URL('data/index.json',base).href);
 await window.fetch(new Request(loc.origin+'/data/games/sky-cd/sky.dsk',{headers:{Range:'bytes=0-1023'}}));
 assert.equal(calls.at(-1).input.url,new URL('data/games/sky-cd/sky.dsk',base).href);
 assert.equal(calls.at(-1).input.headers.get('Range'),'bytes=0-1023');
 await window.fetch('https://example.org/data/index.json');
 assert.equal(calls.at(-1).input,'https://example.org/data/index.json');
 let resumed=false;
 window.Module.SDL3={audioContext:{state:'suspended',async resume(){this.state='running';resumed=true}}};
 await vm.runInContext('enableAudio()',context);
 assert(resumed,'Audio unlock must resume the SDL context');
 assert.equal(get('sound').textContent,'Sound enabled');
}
console.log('PASS: CD files, speech settings, WebAssembly, directory indexes, /bass/ and localhost routing, Range headers and audio unlock.');
