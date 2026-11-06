export const soundtrack={
 garden:{file:'garden-v2.ogg',name:'Растущий сад',gain:.65},
 forge:{file:'forge.ogg',name:'Кузница пешек',gain:.8},
 ice:{file:'ice.ogg',name:'Замерзшие земли',gain:.8},
 crypt:{file:'crypt.ogg',name:'Некрополь',gain:.75},
 ruins:{file:'ruins.ogg',name:'Расколотые палаты',gain:.8},
 court:{file:'court.ogg',name:'Дворец императора',gain:.65},
 emperor:{file:'emperor.ogg',name:'Император',gain:1},
};
export function soundtrackFor({biome='ruins',emperor=false,stage='exploring'}={}){
 return emperor&&!['victory','defeat','results','boss-reward'].includes(stage)?'emperor':soundtrack[biome]?biome:'ruins';
}
