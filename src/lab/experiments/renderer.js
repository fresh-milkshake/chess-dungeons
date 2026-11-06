import {vertexSource,fragmentSource} from './source.js';

export function createExperimentRenderer(canvas, board, root, onError) {
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false});
 if(!gl)throw new Error('Для экспериментов нужен WebGL2. Аппаратное ускорение недоступно.');
 let program,locations,frame=0,last=0,time=0,theme=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,lost=false,disposed=false,selection=[-10,-10];
 let effects=[],visible=true,variant=0,recipe=null;
 const programs=new Map();
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 function initialize(){
  if(programs.has(theme)){({program,locations}=programs.get(theme));canvas.dataset.program='linked';return;}
  const shaders=[];
  try{
   program=gl.createProgram();
   const specialized=fragmentSource.replace('uniform int theme;',`const int theme=${theme};`);
   for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,specialized]]){
    const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
   }
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
   locations=Object.fromEntries(['resolution','board','time','theme','materialVariant','moves[0]','selected','recipeEnabled','recipeKinds','recipeDarkA','recipeDarkB','recipeLightA','recipeLightB','recipeScales','recipePolishes'].map(k=>[k,gl.getUniformLocation(program,k)]));canvas.dataset.program='linked';
   programs.set(theme,{program,locations});
  }catch(error){if(program)gl.deleteProgram(program);throw error;}finally{shaders.forEach(s=>gl.deleteShader(s));}
 }
 initialize();
 function draw(now){
  frame=0;if(disposed||lost||root.hidden||document.hidden||!visible)return;
  if(!paused&&last)time+=Math.min((now-last)/1000,.06);last=now;
  const rect=canvas.getBoundingClientRect(),b=board.getBoundingClientRect();
  const scale=Math.min(devicePixelRatio,1.5,1400/Math.max(rect.width,rect.height));
  const w=Math.max(1,Math.round(rect.width*scale)),h=Math.max(1,Math.round(rect.height*scale));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.useProgram(program);
  gl.uniform2f(locations.resolution,w,h);gl.uniform4f(locations.board,(b.x-rect.x)*scale,(b.y-rect.y)*scale,b.width*scale,b.height*scale);
  gl.uniform1f(locations.time,time);gl.uniform1i(locations.theme,theme);gl.uniform2fv(locations.selected,selection);
  gl.uniform1i(locations.materialVariant,variant);
  gl.uniform1i(locations.recipeEnabled,recipe?1:0);
  if(recipe){
   gl.uniform2i(locations.recipeKinds,recipe.dark.kind,recipe.light.kind);
   gl.uniform3fv(locations.recipeDarkA,recipe.darkA);gl.uniform3fv(locations.recipeDarkB,recipe.darkB);
   gl.uniform3fv(locations.recipeLightA,recipe.lightA);gl.uniform3fv(locations.recipeLightB,recipe.lightB);
   gl.uniform2f(locations.recipeScales,recipe.dark.scale,recipe.light.scale);
   gl.uniform2f(locations.recipePolishes,recipe.dark.polish,recipe.light.polish);
  }
  const moves=new Float32Array(32);for(let i=0;i<8;i++)moves[i*4+2]=1e6;
  effects.forEach((e,i)=>moves.set([...e.to,e.time,e.capture?1:0],i*4));
  gl.uniform4fv(locations['moves[0]'],moves);gl.drawArrays(gl.TRIANGLES,0,3);
  if(!paused)frame=requestAnimationFrame(draw);
 }
 function wake(){if(disposed||lost)return;last=0;if(!frame)frame=requestAnimationFrame(draw);}
 const observe=new MutationObserver(wake);observe.observe(root,{attributes:true,attributeFilter:['hidden']});
 const resize=new ResizeObserver(wake);resize.observe(canvas);resize.observe(board);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;wake();});intersection.observe(canvas);
 document.addEventListener('visibilitychange',wake);
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;canvas.dataset.program='lost';onError('GPU-контекст потерян. Ожидаем восстановления…');});
 canvas.addEventListener('webglcontextrestored',()=>{try{programs.clear();initialize();lost=false;onError('');wake();}catch(error){onError(error.message);}});
 wake();
 const point=s=>[s.charCodeAt(0)-97-3.5,8-Number(s[1])-3.5];
 return {
  theme(value){theme=value;variant=0;recipe=null;effects=[];try{initialize();onError('');wake();}catch(error){onError(error.message);}},
  variant(value){variant=value;effects=[];wake();},
  recipe(sample){recipe={dark:sample.dark,light:sample.light,darkA:rgb(sample.dark.a),darkB:rgb(sample.dark.b),lightA:rgb(sample.light.a),lightB:rgb(sample.light.b)};wake();},
  select(square){selection=square?[square.charCodeAt(0)-97,8-Number(square[1])]:[-10,-10];wake();},
  move(move){effects=[...effects.filter(e=>time-e.time<2.4),{to:point(move.to),time,capture:!!move.captured}].slice(-8);wake();},
  clear(){effects=[];wake();},
  pause(value){paused=value;wake();},
  get paused(){return paused;},
  dispose(){disposed=true;cancelAnimationFrame(frame);observe.disconnect();resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',wake);for(const entry of programs.values())gl.deleteProgram(entry.program);programs.clear();},
 };
}
