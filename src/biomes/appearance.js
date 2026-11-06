// Shared palette and bounded procedural coordinates for lab and gameplay.
export const biomeAppearance={
 ruins:{wall:'#454640',light:'#d5c4a4',dark:'#827563'},
 garden:{wall:'#394d3b',light:'#c5c9a3',dark:'#74866b'},
 forge:{wall:'#292521',light:'#8c7761',dark:'#40362e'},
 ice:{wall:'#3f5965',light:'#c6dbe0',dark:'#779da9'},
 crypt:{wall:'#45404f',light:'#c2b8c8',dark:'#7b708b'},
 court:{wall:'#48483f',light:'#d7caa6',dark:'#777767'},
};
export function terrainSeed(id){
 const [x,y]=id.includes(',')?id.split(',').map(Number):[id.charCodeAt(0)-97,Number(id.slice(1))];
 return ((x*97+y*163+11)%1021+1021)%1021;
}
