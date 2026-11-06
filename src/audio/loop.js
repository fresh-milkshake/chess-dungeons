/** Correct only the decoded codec edges; preserve the loop's middle and avoid a fade-to-silence. */
export function smoothLoopEdges(buffer,milliseconds=6){
 const count=Math.min(Math.floor(buffer.length/4),Math.max(2,Math.round(buffer.sampleRate*milliseconds/1000)));
 for(let channel=0;channel<buffer.numberOfChannels;channel++){
  const samples=buffer.getChannelData(channel);if(samples.length<8)continue;const first=samples[0],last=samples.at(-1),join=(first+last)/2;
  for(let i=0;i<count;i++){const x=i/(count-1),weight=1-x*x*(3-2*x);samples[i]+=(join-first)*weight;samples[samples.length-1-i]+=(join-last)*weight;}
 }
 return buffer;
}
