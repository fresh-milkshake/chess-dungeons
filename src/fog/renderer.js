import {vertexSource} from '../lab/shaders/source.js';
import {fogFragment} from './shader.js';

/** One pass, small noise layers, one tiny knowledge texture; shared with the lab. */
export function createFogRenderer(canvas){
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false,stencil:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const shaders=[],program=gl.createProgram();
 for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fogFragment]]){
  const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);
 }
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 shaders.forEach(s=>gl.deleteShader(s));gl.useProgram(program);gl.bindVertexArray(gl.createVertexArray());
 const locations=Object.fromEntries(['knowledge','time','variant','worldOrigin','worldSize','maskSize','boardTint','patternOffset'].map(n=>[n,gl.getUniformLocation(program,n)]));
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
 for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
 gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.uniform1i(locations.knowledge,0);
 gl.uniform3f(locations.boardTint,211.5/255,176.5/255,137/255);
 let maskWidth=0,maskHeight=0;
 return {
  setTint(color){gl.uniform3fv(locations.boardTint,color);},
  setOffset(offset){gl.uniform2fv(locations.patternOffset,offset);},
  setMask(width,height,data,worldSize=[width,height]){
   if(width!==maskWidth||height!==maskHeight){gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,width,height,0,gl.RED,gl.UNSIGNED_BYTE,data);maskWidth=width;maskHeight=height;}
   else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RED,gl.UNSIGNED_BYTE,data);
   gl.uniform2fv(locations.maskSize,worldSize);
  },
  draw(time,variant,origin=[0,0],size=[9,6]){
   gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(locations.time,time);gl.uniform1i(locations.variant,variant);
   gl.uniform2fv(locations.worldOrigin,origin);gl.uniform2fv(locations.worldSize,size);gl.drawArrays(gl.TRIANGLES,0,3);
  },
 };
}
