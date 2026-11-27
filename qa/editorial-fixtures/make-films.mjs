// Local evaluation sources: no Chrome profile, external assets or network services required.
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sources = fileURLToPath(new URL('./', import.meta.url));
const films = JSON.parse(readFileSync(join(sources,'observations.json')));
const out = resolve(process.argv[2] || mkdtempSync(join(tmpdir(),'lumina-films-')));
const inRepo = relative(resolve(sources,'../..'), out);
if (!inRepo.startsWith('..') && !isAbsolute(inRepo)) {
  throw Error('Choose a temporary output directory outside the skill checkout.');
}
mkdirSync(out,{recursive:true});
const which = name => {
  try { return execFileSync('which',[name],{encoding:'utf8'}).trim(); } catch { return ''; }
};
const chrome = [process.env.CHROME, which('chromium'), which('google-chrome'), which('chromium-browser'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path=>path&&existsSync(path));
const ffmpeg = [process.env.FFMPEG_PATH, process.env.FFMPEG, which('ffmpeg'),
  join(process.env.HOME || '', '.local/share/lumina-sfx/tools/ffmpeg')].find(path=>path&&existsSync(path));
if (!chrome || !ffmpeg) throw Error('Set CHROME and FFMPEG to local executable paths.');
const encode = args => execFileSync(ffmpeg, ['-hide_banner','-loglevel','error','-y',...args]);
const profile = mkdtempSync(join(tmpdir(),'lumina-film-chrome-'));
const browser = spawn(chrome, ['--headless','--disable-gpu','--hide-scrollbars','--no-first-run',
  '--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions',
  '--remote-debugging-pipe','--window-size=640,360','--user-data-dir='+profile,'about:blank'],
  {stdio:['ignore','ignore','ignore','pipe','pipe']});
const closed = once(browser,'close');
const waiting = new Map();
let pending = '', seq=0;
browser.stdio[4].setEncoding('utf8');
browser.stdio[4].on('data', chunk => {
  pending += chunk;
  let boundary;
  while ((boundary=pending.indexOf('\0'))!==-1) {
    const message=JSON.parse(pending.slice(0,boundary));
    pending=pending.slice(boundary+1);
    const request=waiting.get(message.id);
    if(request) {
      waiting.delete(message.id);
      if(message.error)request.reject(Error(message.error.message)); else request.resolve(message.result);
    }
  }
});
browser.once('close',()=>{ for(const {reject} of waiting.values())reject(Error('Browser closed')); });
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++seq;waiting.set(id,{resolve,reject});
  browser.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
});
try {
  const {targetId}=await call('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const page=(method,params)=>call(method,params,sessionId);
  await page('Emulation.setDeviceMetricsOverride',{width:640,height:360,deviceScaleFactor:1,mobile:false});
  await page('Page.navigate',{url:pathToFileURL(join(sources,'films.html')).href});
  const ready=await page('Runtime.evaluate',{expression:"new Promise(resolve=>{if(document.readyState==='complete' && window.paint)resolve();else window.addEventListener('load',()=>resolve(),{once:true})})",awaitPromise:true});
  if(ready.exceptionDetails)throw Error('Film page failed to initialize');
  for(const [name,film] of Object.entries(films)) {
    const directory=join(out,name);
    mkdirSync(directory);
    const timeline={fps:30,...film};
    writeFileSync(join(directory,'timeline.json'),JSON.stringify(timeline,null,2)+'\n');
    const visual=join(directory,'picture.mp4');
    const pipe=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-framerate','30','-f','image2pipe','-c:v','png','-i','pipe:0','-c:v','libx264','-pix_fmt','yuv420p','-crf','16','-movflags','+faststart',visual],{stdio:['pipe','ignore','inherit']});
    const finished=once(pipe,'close');
    let png;
    for(let frame=0;frame<film.durationFrames;frame++) {
      const result=await page('Runtime.evaluate',{expression:'paint('+JSON.stringify(name)+','+frame+')',returnByValue:true});
      if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
      if(result.result.value) {
        const shot=await page('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:640,height:360,scale:1}});
        png=Buffer.from(shot.data,'base64');
      }
      if(!pipe.stdin.write(png))await once(pipe.stdin,'drain');
    }
    pipe.stdin.end();
    const [status]=await finished;
    if(status)throw Error('Failed to encode '+name);
    const video=join(directory,'source.mp4');
    let audio;
    if(name==='estuary') {
      const line='Choose the tide table to see when the water rises. Turn on the station marks.';
      const say=which('say'), espeak=which('espeak-ng')||which('espeak');
      if(say) {
        audio=join(directory,'fixture-voice.aiff');
        execFileSync(say,['-r','178','-o',audio,line]);
      } else if(espeak) {
        audio=join(directory,'fixture-voice.wav');
        execFileSync(espeak,['-s','178','-w',audio,line]);
      } else throw Error('The narration fixture requires local say, espeak-ng or espeak.');
    } else if(name==='swatch') {
      audio=join(directory,'fixture-contact.wav');
      // An existing centered source contact at frame 54, generated independently of the SFX library.
      encode(['-f','lavfi','-i','sine=frequency=1130:duration=0.046:sample_rate=48000','-af','afade=t=out:st=0.003:d=0.041,adelay=1800,apad','-t',String(film.durationFrames/30),audio]);
    }
    if(audio) encode(['-i',visual,'-i',audio,'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-af','apad','-t',String(film.durationFrames/30),'-movflags','+faststart',video]);
    else encode(['-i',visual,'-c','copy','-movflags','+faststart',video]);
    rmSync(visual);
    console.log(video);
  }
} finally {
  browser.kill();
  await closed;
  rmSync(profile,{recursive:true,force:true});
}
