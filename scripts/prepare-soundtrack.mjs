import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const tracks=JSON.parse(await readFile('outputs/audio-import/sources.json','utf8')),report=[];
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true});if(r.status!==0)throw Error(r.stderr||r.error);return r.stdout;};
for(const t of tracks){
 const raw=`outputs/audio-import/${t.id}.${t.url.split('.').at(-1)}`,sourceDuration=Number(JSON.parse(run('ffprobe',['-v','quiet','-show_format','-of','json',raw])).format.duration),duration=t.id==='ruins'?Math.min(120,sourceDuration):sourceDuration,f=t.id==='garden'?1.5:t.id==='emperor'?.008:.08;
 // Body followed by tail/head overlap: end->start is contiguous source audio, not silence.
 const graph=`[0:a]aresample=32000,asplit=3[a][b][c];[a]atrim=start=${f}:end=${duration-f},asetpts=PTS-STARTPTS[body];[b]atrim=start=${duration-f}:end=${duration},asetpts=PTS-STARTPTS[tail];[c]atrim=start=0:end=${f},asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=${f}:c1=tri:c2=tri[join];[body][join]concat=n=2:v=0:a=1,alimiter=limit=0.89:level=false,volume=${({garden:-2.8,forge:-3.4,ice:9.6,crypt:-4.1,ruins:-3.3,court:-14,emperor:-10.34})[t.id]}dB[out]`;
 run('ffmpeg',['-v','error','-y','-i',raw,'-filter_complex',graph,'-map','[out]','-ar','32000','-ac','2','-c:a','libvorbis','-q:a','4',`public/audio/${t.id}.ogg`]);
 const metadata=JSON.parse(run('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',`public/audio/${t.id}.ogg`]));
 report.push({...t,file:`${t.id}.ogg`,duration:Number(metadata.format.duration),bytes:Number(metadata.format.size),processing:`Resampled to 32kHz stereo Vorbis, cyclic seam crossfade ${f}s, peak limiter, per-track constant loudness trim.`});console.log(t.id,metadata.format.duration,metadata.format.size);
}
await writeFile('public/audio/manifest.json',JSON.stringify(report,null,2)+'\n');
await writeFile('outputs/audio-import/processing.json',JSON.stringify(report,null,2));
