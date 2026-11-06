const profiles=[
 {id:'halls',name:'Залы',width:[18,24],height:[18,22],loops:1,fill:.7},
 {id:'galleries',name:'Галереи',width:[22,28],height:[16,20],loops:1,fill:.8},
 {id:'courts',name:'Дворы',width:[20,24],height:[20,24],loops:2,fill:.9},
 {id:'warrens',name:'Переплетение',width:[20,26],height:[18,24],loops:2,fill:.45},
];
const distance=(a,b)=>Math.abs(a.cx-b.cx)+Math.abs(a.cy-b.cy);

/** BSP rooms, a spanning tree and local loops; every passage is two cells wide. */
export function generateLayout(seed,random,{rooms}={}){
 const integer=(min,max)=>min+Math.floor(random()*(max-min+1));
 const profile=profiles[integer(0,profiles.length-1)];
 const target=rooms??integer(4,5);if(!Number.isInteger(target)||target<3||target>8)throw Error('Допустимо 3–8 комнат.');
 const scale=Math.sqrt(target/4.5),dimension=range=>Math.max(16,Math.round(integer(range[0]/2,range[1]/2)*scale)*2);
 let width=dimension(profile.width);const height=dimension(profile.height);
 while(Math.floor((width-2)/6)*Math.floor((height-2)/6)<target)width+=2;
 const map={width,height,seed:seed>>>0,generation:3,layout:profile.id,layoutName:profile.name,tiles:Array(width*height).fill(0),rooms:[],links:[]};
 const leaves=[{x:1,y:1,w:width-2,h:height-2}];
 while(leaves.length<target){
  const capacity=leaf=>Math.floor(leaf.w/6)*Math.floor(leaf.h/6),total=leaves.reduce((sum,leaf)=>sum+capacity(leaf),0);
  const cuts=(leaf,vertical)=>Array.from({length:Math.max(0,(vertical?leaf.w:leaf.h)-11)},(_,i)=>i+6).filter(cut=>total-capacity(leaf)+(vertical?Math.floor(cut/6)*Math.floor(leaf.h/6)+Math.floor((leaf.w-cut)/6)*Math.floor(leaf.h/6):Math.floor(leaf.w/6)*Math.floor(cut/6)+Math.floor(leaf.w/6)*Math.floor((leaf.h-cut)/6))>=target);
  const candidates=leaves.map(leaf=>({leaf,vertical:cuts(leaf,true),horizontal:cuts(leaf,false),score:leaf.w*leaf.h*(.7+random()*.6)})).filter(c=>c.vertical.length||c.horizontal.length).sort((a,b)=>b.score-a.score);
  if(!candidates.length)break;
  const leaf=candidates[0].leaf;leaves.splice(leaves.indexOf(leaf),1);
  let vertical=leaf.w/leaf.h>1.3?true:leaf.h/leaf.w>1.3?false:random()<(profile.id==='galleries'?.7:.5);
  if(!candidates[0].vertical.length)vertical=false;if(!candidates[0].horizontal.length)vertical=true;
  const size=vertical?leaf.w:leaf.h,valid=vertical?candidates[0].vertical:candidates[0].horizontal,balanced=valid.filter(c=>c>=size*.35&&c<=size*.65),pool=balanced.length?balanced:valid,cut=pool[integer(0,pool.length-1)];
  leaves.push(vertical?{...leaf,w:cut}:{...leaf,h:cut},vertical?{...leaf,x:leaf.x+cut,w:leaf.w-cut}:{...leaf,y:leaf.y+cut,h:leaf.h-cut});
 }
 const carve=(x,y)=>{if(x>0&&y>0&&x<width-1&&y<height-1)map.tiles[y*width+x]=1;};
 for(const leaf of leaves){
  const maxW=leaf.w-2,maxH=leaf.h-2;
  const w=integer(3,Math.max(3,Math.round(3+(maxW-3)*profile.fill))),h=integer(3,Math.max(3,Math.round(3+(maxH-3)*profile.fill)));
  const x=leaf.x+integer(1,leaf.w-w-1),y=leaf.y+integer(1,leaf.h-h-1);
  const room={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};map.rooms.push(room);
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)carve(xx,yy);
 }
 const connected=new Set([integer(0,map.rooms.length-1)]),edges=new Set(),degrees=map.rooms.map(()=>0);
 const edgeKey=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
 const connect=(a,b,kind='loop')=>{edges.add(edgeKey(a,b));map.links.push({a,b,kind});degrees[a]++;degrees[b]++;};
 // A tree gives reachability without forcing rooms into a fixed circular order.
 while(connected.size<map.rooms.length){
  let best;
  for(const a of connected)for(let b=0;b<map.rooms.length;b++)if(!connected.has(b)){
   const score=distance(map.rooms[a],map.rooms[b])*(.85+random()*.3);
   if(!best||score<best.score)best={a,b,score};
  }
  connect(best.a,best.b,'tree');connected.add(best.b);
 }
 // Each room gets at least two connections. Extra chords create several loops.
 for(let a=0;a<map.rooms.length;a++)while(degrees[a]<2){
  const options=map.rooms.map((room,b)=>({b,score:distance(map.rooms[a],room)*(1+random()*.35)})).filter(({b})=>b!==a&&!edges.has(edgeKey(a,b))).sort((a,b)=>a.score-b.score);
  connect(a,options[0].b);
 }
 const options=[];
 for(let a=0;a<map.rooms.length;a++)for(let b=a+1;b<map.rooms.length;b++)if(!edges.has(edgeKey(a,b)))options.push({a,b,score:distance(map.rooms[a],map.rooms[b])*(.6+random())});
 options.sort((a,b)=>a.score-b.score);
 // One longer chord cuts across the layout instead of extending its perimeter.
 if(options.length){const [{a,b}]=options.splice(Math.floor(options.length*.65),1);connect(a,b);}
 while(map.links.length<map.rooms.length+profile.loops&&options.length){const {a,b}=options.shift();connect(a,b);}
 for(const {a,b,kind} of map.links){
  const from=map.rooms[a],to=map.rooms[b];let x=from.cx,y=from.cy;
  const patch=()=>{carve(x,y);carve(x+1,y);carve(x,y+1);carve(x+1,y+1);};
  const go=(tx,ty)=>{patch();while(x!==tx){x+=Math.sign(tx-x);patch();}while(y!==ty){y+=Math.sign(ty-y);patch();}};
  if(kind==='loop'){
   const mx=Math.max(2,Math.min(width-4,Math.round((x+to.cx)/2)+integer(-2,2))),my=Math.max(2,Math.min(height-4,Math.round((y+to.cy)/2)+integer(-2,2)));
   const routes=[[[to.cx,y],[to.cx,to.cy]],[[x,to.cy],[to.cx,to.cy]],[[mx,y],[mx,to.cy],[to.cx,to.cy]],[[x,my],[to.cx,my],[to.cx,to.cy]]];
   const score=route=>{
    let xx=x,yy=y,length=0;const newCells=new Set();
    const count=()=>{for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]])if(!map.tiles[(yy+dy)*width+xx+dx])newCells.add((yy+dy)*width+xx+dx);};
    count();for(const [tx,ty] of route){while(xx!==tx){xx+=Math.sign(tx-xx);length++;count();}while(yy!==ty){yy+=Math.sign(ty-yy);length++;count();}}
    return newCells.size-length*.2;
   };
   routes.sort((a,b)=>score(b)-score(a));for(const [tx,ty] of routes[0])go(tx,ty);
  }else if(profile.id==='warrens'&&random()<.6){
   const mx=Math.max(2,Math.min(width-4,Math.round((x+to.cx)/2)+integer(-2,2))),my=Math.max(2,Math.min(height-4,Math.round((y+to.cy)/2)+integer(-2,2)));
   go(mx,my);go(to.cx,to.cy);
  }else if(random()<.5){go(to.cx,y);go(to.cx,to.cy);}
  else {const original=x;go(original,to.cy);go(to.cx,to.cy);}
 }
 const boundary=room=>Math.min(room.cx,room.cy,width-1-room.cx,height-1-room.cy);
 const peripheral=map.rooms.map((room,index)=>({index,score:boundary(room)+random()*2})).sort((a,b)=>a.score-b.score).slice(0,3);
 map.startRoom=peripheral[integer(0,peripheral.length-1)].index;
 const start=map.rooms[map.startRoom];map.start={x:start.cx,y:start.cy};
 const distances=Array(width*height).fill(-1),queue=[start.cy*width+start.cx];distances[queue[0]]=0;
 for(let i=0;i<queue.length;i++)for(const delta of [-width,width,-1,1]){
  const next=queue[i]+delta;
  if(map.tiles[next]===1&&distances[next]===-1){distances[next]=distances[queue[i]]+1;queue.push(next);}
 }
 map.exitRoom=map.rooms.reduce((best,room,i)=>distances[room.cy*width+room.cx]>distances[map.rooms[best].cy*width+map.rooms[best].cx]?i:best,map.startRoom);
 const exit=map.rooms[map.exitRoom];map.exit={x:exit.cx,y:exit.cy};
 return map;
}
