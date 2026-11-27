import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegPath } from '../scripts/audio-export.mjs';
import { withPictureTravel } from '../scripts/edit-region.mjs';
import { planEdit } from '../scripts/edit-score.mjs';
import { renderEdit } from '../scripts/edit-render.mjs';

const bank = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url))).sounds;
const timeline = e => ({ id:'page-turn', fps:30, durationFrames:40, events:[e] });
const slide = { id:'sheet', target:'folio', action:'slide', frame:0, endFrame:20, accent:true };
const cue = event => planEdit(timeline(event), bank).cues[0];
const travel = [[0,125],[3,110],[6,50],[9,30],[20,0]].map(([frame,x]) => ({frame,x}));

test('an observed slide follows the fastest interval; static and reversing selections stay in review', async () => {
  assert.equal(cue({...slide, travel}).syncFrame,5);
  assert.equal(cue({...slide, travel}).direction,'left');
  assert.equal(cue({...slide, travel, syncFrame:7}).syncFrame,7);
  assert.equal(cue({...slide, travel, accent:false}).decision,'silence');
  assert.equal(cue({...slide, travel, direction:'right'}).decision,'review');
  for (const x of [[0,0,0],[0,5,1]])
    assert.equal(cue({...slide, travel:x.map((v,i)=>({frame:i*10,x:v}))}).decision,'review');
  assert.throws(()=>cue({...slide,travel:travel.slice(1)}),/both slide bounds/);
  assert.equal(cue({...slide, travelRegion:{x:0,y:0,width:96,height:48}}).decision,'review');
  const dir=await mkdtemp(join(tmpdir(),'lumina-travel-'));
  try {
    const file=join(dir,'turn.wav');
    await renderEdit(planEdit(timeline({...slide, travel}),bank),bank,file);
    const wav=await readFile(file);
    // At frame 6 the leftward panel has passed halfway, well before the time midpoint.
    let left=0,right=0;
    for (let i=6*1470; i<6*1470+440; i++) {
      left+=wav.readInt16LE(44+i*4)**2;
      right+=wav.readInt16LE(46+i*4)**2;
    }
    assert.ok(left>1.45*right && right>0);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('a textured viewport in a movie supplies the swipe direction and crest; an unmoving region adds nothing', async t => {
  const ff=ffmpegPath();
  if (spawnSync(ff,['-version']).error?.code==='ENOENT') return t.skip('FFmpeg required');
  const dir=await mkdtemp(join(tmpdir(),'lumina-motion-picture-'));
  try {
    const width=144, height=24, count=21, image=Buffer.alloc(width*height*count);
    const positions=[0,0,1,3,8,18,34,56,70,80,89,95,100,103,105,106,107,108,108,108,108];
    for (let frame=0;frame<count;frame++)
      for (let y=0;y<height;y++)
        for (let x=0;x<width;x++) {
          const col=x+positions[frame];
          image[(frame*height+y)*width+x]=y<18 ? ((col*37+y*13)^(col*col*3)) & 255 : 108;
        }
    const raw=join(dir,'pixels'), movie=join(dir,'page.mkv');
    await writeFile(raw,image);
    const made=spawnSync(ff,['-v','error','-f','rawvideo','-pixel_format','gray','-video_size','144x24',
      '-framerate','30','-i',raw,'-c:v','ffv1',movie]);
    assert.equal(made.status,0,made.stderr.toString());
    const sample=async region => {
      const input=timeline({...slide,travelRegion:region});
      const measured=await withPictureTravel(input,movie,30,40);
      return planEdit(measured,bank).cues[0];
    };
    const moving=await sample({x:0,y:0,width:144,height:18});
    assert.deepEqual([moving.decision,moving.direction,moving.syncFrame],['play','left',7]);
    assert.equal((await sample({x:0,y:18,width:144,height:6})).decision,'review');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
