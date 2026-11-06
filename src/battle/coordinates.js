// Extended boards keep ordinary UCI moves, with variable-length rank numbers.
export const files='abcdefghijklmnop';
export const rank=s=>Number(s.slice(1));
export function moveParts(move){const m=move.match(/^([a-p]\d{1,2})([a-p]\d{1,2})([qnrb])?$/);return m?{from:m[1],to:m[2],promotion:m[3]}:{from:'',to:'',promotion:undefined};}
export function boardAxes(bounds,flipped=false){
 const columns=files.slice(bounds.left,bounds.right+1).split(''),ranks=Array.from({length:bounds.top-bounds.bottom+1},(_,i)=>bounds.top-i);
 return {columns:flipped?columns.reverse():columns,ranks:flipped?ranks.reverse():ranks};
}
