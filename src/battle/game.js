import {moveParts,rank as squareRank,files,boardAxes} from './coordinates.js';
import { Chess } from 'chess.js';
import { parsePosition } from '../lab/scenarios.js';
import {validateDebugPosition} from '../debug/position.js';
import {chessFen} from './geometry.js';
import {initialRelicPosition} from '../artifacts/initial.js';
import {artifactById} from '../artifacts/catalog.js';
import {presetArtifactUses} from '../artifacts/charges.js';

const standard = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const battles = [
  { id: 'skirmish', name: 'Столкновение', description: 'Полные армии. Каменные кони, стеклянные слоны, эфирные кони и усиленные ладьи. Вы играете белыми.', fen: standard + ' @hunt=1;b1=2/1/0;b8=2/1/0;c1=1/1/1;c8=1/1/1;h1=1/2/0;h8=1/2/0', ethereal: ['g1','g8'] },
  { id: 'scout', name: 'Первая вылазка', description: 'Ваш стартовый отряд: король, ферзь и конь. Против вас — ладья, слон и две пешки.', fen: '2b2rk1/3p1p2/8/8/8/8/8/1N1Q2K1 w - - 0 1 @hunt=1' },
  { id: 'boss', name: 'Алмазный страж', description: 'У стража алмазная ладья. Ваш конь усилен, а ладья защищена камнем. Приоритет стеклянных целей у босса отключён.', fen: '3r2k1/5pp1/8/8/8/8/5PP1/R2Q1NK1 w - - 0 1 @hunt=0;d8=3/1/0;a1=2/1/0;f1=1/2/0' },
  { id: 'ordinary', name: 'Обычная партия', description: 'Стандартные шахматы на том же движке. Без прочности и усиления.', fen: standard + ' @hunt=0' },
];

export function outcome(state, resigned = false) {
  if (resigned) return { title: 'Поражение', detail: 'Вы сдались.', result: 'loss' };
  if(state.wildMode)return state.gameResult??null;
  if (!state.legal.length) {
    if (!state.check) return { title: 'Ничья', detail: 'Пат: нет допустимых ходов.', result: 'draw' };
    const won = parsePosition(state.fen).turn === 'b';
    return { title: won ? 'Победа' : 'Поражение', detail: won ? 'Вы поставили мат.' : 'Противник поставил мат.', result: won ? 'win' : 'loss' };
  }
  const {pieces}=parsePosition(state.fen);
  if (![...pieces.values()].some(p=>p.hp>1) && new Chess(chessFen(state.fen)).isInsufficientMaterial()) return { title:'Ничья', detail:'Недостаточно материала для мата.', result:'draw' };
  return state.draw ? { title: 'Ничья', detail: 'Повторение позиции или правило 50 ходов.', result: 'draw' } : null;
}

export function moveDetails(fen, uci, hit) {
  if(uci==='0000'){const turn=parsePosition(fen).turn;return {from:'',to:'',target:'',flags:'',color:turn==='x'?'wild':turn,label:`${turn==='x'?'Дикая фигура':'Противник'} пропускает ход`};}
  const { pieces, turn } = parsePosition(fen);
  const from = moveParts(uci).from, encodedTo = moveParts(uci).to, piece = pieces.get(from);
  // Accept both standard UCI king destination and Chess960 king-to-rook encoding.
  const rookTarget = piece?.type === 'k' && pieces.get(encodedTo)?.color === turn && pieces.get(encodedTo)?.type === 'r';
  const castle = rookTarget || (piece?.type === 'k' && from.slice(1) === encodedTo.slice(1) && Math.abs(from.charCodeAt(0)-encodedTo.charCodeAt(0))===2);
  const rookFrom = castle ? rookTarget ? encodedTo : `${encodedTo[0]>from[0]?'h':'a'}${from.slice(1)}` : null;
  const to = castle ? `${encodedTo[0] > from[0] ? 'g' : 'c'}${from.slice(1)}` : encodedTo;
  const enPassant = piece?.type === 'p' && from[0] !== to[0] && !pieces.has(to);
  const target = enPassant ? `${to[0]}${from.slice(1)}` : to;
  const flags = castle ? (to[0] === 'g' ? 'k' : 'q') : '';
  const label = castle ? (flags === 'k' ? 'O-O' : 'O-O-O') : `${from}${hit ? ' ⚔ ' : pieces.has(target) ? ' × ' : ' → '}${to}${!hit && moveParts(uci).promotion ? '=' + moveParts(uci).promotion.toUpperCase() : ''}`;
  return { from, to, encodedTo, target, castle, rookFrom, enPassant, flags, color: turn, captured:!castle&&!hit?pieces.get(target)?.type:undefined, label };
}

export function moveEthereal(squares, fen, uci, hit) {
  const next = new Set(squares);
  if (hit) return next;
  const m = moveDetails(fen, uci, hit), moving = next.has(m.from);
  next.delete(m.from); next.delete(m.target); next.delete(m.to);
  if (moving) next.add(m.to);
  if (m.castle && next.delete(m.rookFrom)) next.add(`${m.to[0] === 'g' ? 'f' : 'd'}${m.from.slice(1)}`);
  return next;
}

export class Battle {
  constructor(engine) { this.engine = engine; this.history = []; this.moves = []; this.ethereal = new Set(); }
  get result() { return outcome(this.state, this.resigned); }
  async start(preset,preparedState=null) {
    const initial=initialRelicPosition(preset);
    const state = initial.fen===preset.fen&&preparedState?preparedState:await this.engine.request('load ' + initial.fen);
    this.preset = preset; this.state = state; this.resigned = false;
    this.history = []; this.moves = []; this.ethereal = new Set(preset.ethereal ?? []);
    this.artifactRuntime={owned:[...(preset.artifacts??[])],used:presetArtifactUses(preset),toggles:{...(preset.artifactToggles??{})},sealedIds:[],frozenId:initial.frozenId};
  }
  async move(uci,{replay=false}={}) {
    const ability=uci.startsWith('artifact ')?JSON.parse(uci.slice(9)):null;
    if(ability&&!replay){const a=artifactById(ability.id);if(!a||!this.artifactRuntime.owned.includes(ability.id)||(this.artifactRuntime.used[ability.id]??0)>=(a.charges??0))throw Error('Артефакт уже использован или недоступен.');}
    if (this.result || !ability&&!this.state.legal.includes(uci)) throw new Error('Этот ход недоступен.');
    const previous = this.state, state = await this.engine.request(ability?uci:'move ' + uci);
    this.history.push({ state: previous, ethereal: new Set(this.ethereal),sealedIds:[...this.artifactRuntime.sealedIds] });
    this.ethereal = ability?new Set(state.ethereal):moveEthereal(this.ethereal, previous.fen, uci, state.hit);
    if(['seal','lastcrown'].includes(ability?.id)&&ability.sourceId)this.artifactRuntime.sealedIds.push(ability.sourceId);
    if(ability)this.artifactRuntime.used[ability.id]=(this.artifactRuntime.used[ability.id]??0)+1;
    if(parsePosition(state.fen).pieces.relics?.glassUsed)this.artifactRuntime.used.glassward=1;
    this.moves.push(ability?{uci,artifact:ability.id,flags:'',hit:true,from:'',to:'',target:'',color:'w',label:'Способность артефакта'}:{ uci, hit: state.hit, ...moveDetails(previous.fen, uci, state.hit),terrainRemoved:state.terrainRemoved,terrainWildIds:state.terrainWildIds,capturedWildId:state.capturedWildId });
    this.state = state;
    return this.moves.at(-1);
  }
  async undoTurn(onUndo=()=>{}) {
    if (!this.history.length) return;
    do {
      const previous = this.history.at(-1),move=this.moves.at(-1);
      const state = await this.engine.request(move.uci==='charge-reset'?'state':'undo');
      this.history.pop(); this.moves.pop(); this.state = state; this.ethereal = previous.ethereal;
      this.artifactRuntime.sealedIds=previous.sealedIds??[];
      this.resigned=false;
      await onUndo(move);
    } while (this.history.length && parsePosition(this.state.fen).turn !== 'w');
    this.resigned = false;
  }
  snapshot() { return { version: 1, preset: this.preset.id, moves: this.moves.map(m=>m.uci), resigned: this.resigned,artifactRuntime:structuredClone(this.artifactRuntime),...(this.preset.debug?{customPreset:JSON.parse(JSON.stringify(this.preset))}:{}) }; }
  async resetArtifactCharges(){
    this.history.push({state:this.state,ethereal:new Set(this.ethereal),sealedIds:[...this.artifactRuntime.sealedIds]});
    if(parsePosition(this.state.fen).pieces.relics)this.state=await this.engine.request('relicrestore glassward');
    this.artifactRuntime.used={};
    this.moves.push({uci:'charge-reset',flags:'',hit:true,from:'',to:'',target:'',color:'w',label:'Заряды реликвий восстановлены'});
  }
  async restore(saved,presetOverride=null) {
    const custom=saved?.customPreset?.debug&&saved.customPreset.id===saved.preset?saved.customPreset:null;
    const preset = presetOverride?.id===saved?.preset ? presetOverride : custom?{...custom,fen:validateDebugPosition(custom.fen)}:battles.find(p=>p.id===saved?.preset);
    if (saved?.version!==1 || !preset || !Array.isArray(saved.moves) || saved.moves.length>2000) throw new Error('Некорректное сохранение');
    await this.start(preset);
    // Explicit debug refills and former ownership are part of recorded history.
    for (const uci of saved.moves)if(uci==='charge-reset')await this.resetArtifactCharges();else await this.move(uci,{replay:true});
    if(saved.artifactRuntime)this.artifactRuntime=structuredClone(saved.artifactRuntime);
    if(parsePosition(this.state.fen).pieces.relics)this.state=await this.engine.request((this.artifactRuntime.used.glassward?'relicspend':'relicrestore')+' glassward');
    this.resigned = saved.resigned === true;
  }
}
