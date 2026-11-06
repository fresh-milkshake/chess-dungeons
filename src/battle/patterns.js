const diagonal=[[1,1],[1,-1],[-1,1],[-1,-1]],straight=[[1,0],[-1,0],[0,1],[0,-1]],knight=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
const rays=(directions,length=15)=>directions.flatMap(([x,y])=>Array.from({length},(_,i)=>[x*(i+1),y*(i+1)]));
const patterns={k:rays([...diagonal,...straight],1),n:knight,b:rays(diagonal),r:rays(straight),q:rays([...diagonal,...straight]),d:[...rays(diagonal),...knight],j:rays(diagonal,2)};
export function movePattern(piece){if(piece.type==='p'){const y=piece.color==='w'?1:-1;return [[0,y],[0,2*y],[-1,y],[1,y]];}return patterns[piece.type]??[];}
