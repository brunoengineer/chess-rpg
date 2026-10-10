/**
 * Translated names/descriptions of game content. English comes from the game data itself;
 * Portuguese is looked up by stable ids (stage id, piece type, card id…). Tests check every id is covered.
 */
import { BOSSES } from '../game/bosses';
import { ARENA_THEME, REGIONS, STAGE_BY_ID, baseId, type RegionDef } from '../game/campaign';
import { CARDS, type CardId } from '../game/cards';
import { BOARD_SKINS, PIECE_SKINS } from '../game/cosmetics';
import { PIECES } from '../game/pieces';
import { RANKS, type Perk } from '../game/ranks';
import type { BossKind, PieceType, StageDef } from '../game/types';

export type Lang = 'en' | 'pt';

export const REGION_PT: Record<number, string> = {
  0: 'A Arena Sem Fim',
  1: 'Campos dos Peões',
  2: 'Bosque Sussurrante',
  3: 'Catedral das Cinzas',
  4: 'Bastião de Pedra',
  5: 'Trono de Obsidiana',
};

/** Per world: stages 1–10, then bonus X1, X2 (same order as campaign.ts). */
export const STAGES_PT: Record<number, string[]> = {
  1: ['Primeiros Passos', 'Briga na Vila', 'Forcados', 'O Cavaleiro Solitário', 'Labirinto de Sebes', 'Cavaleiros Gêmeos', 'Moinho Velho', 'Espantalhos', 'Acampamento dos Bandidos', 'O Golem de Ferro', 'Rixa da Colheita', 'Golem Desperto'],
  2: ['Emboscada na Floresta', 'Matagal', 'Toca da Raposa', 'O Enviado do Bispo', 'Pedras Musgosas', 'Alcateia', 'Patrulha Noturna', 'Cabana dos Caçadores', 'Forte dos Patrulheiros', 'O Corcel Sombrio', 'Caçada Selvagem', 'Corcel dos Pesadelos'],
  3: ['Acólitos', 'Luz de Velas', 'Vitral', 'Confessionário', 'Campanário', 'A Cripta', 'Claustro', 'O Coro', 'Inquisição', 'Arcebispo Malakar', 'Missa Solene', 'Malakar Ascendido'],
  4: ['Muralha Externa', 'Ponte do Fosso', 'Portão da Guarda', 'Arsenal', 'Quartel', 'Máquinas de Cerco', 'A Torre de Menagem', 'Ameias', 'Guarda de Ferro', 'O Colosso de Cerco', 'Último Bastião', 'Colosso Liberto'],
  5: ['Degraus de Cinzas', 'Portão das Brasas', 'Salão dos Espelhos', 'Guarda de Obsidiana', 'Guarda Real', 'Campos de Lava', 'Raça do Dragão', 'Sombra do Trono', 'A Última Muralha', 'Vyrmathra, a Rainha Dragão', 'Corte das Cinzas', 'Chama Eterna'],
};

export const ARENA_NAMES_PT: Record<string, string> = {
  Gladiators: 'Gladiadores',
  'Sand & Steel': 'Areia e Aço',
  'Crowd Pleasers': 'Favoritos da Plateia',
  'Blood Moon Bout': 'Duelo da Lua de Sangue',
  'The Gauntlet': 'O Desafio',
  Champions: 'Campeões',
  'Iron Circle': 'Círculo de Ferro',
  'Last Stand': 'Última Resistência',
};

export const PIECES_PT: Record<PieceType, string> = {
  pawn: 'Peão', knight: 'Cavalo', bishop: 'Bispo', warden: 'Guardião', rook: 'Torre',
  queen: 'Rainha', cardinal: 'Cardeal', marshal: 'Marechal', amazon: 'Amazona',
};

export const RANKS_PT = ['Recruta', 'Sargento', 'Tenente', 'Major', 'Coronel', 'General'];

export const BOSSES_PT: Record<BossKind, { name: string; title: string; moveText: string }> = {
  golem: { name: 'Golem de Ferro', title: 'Guardião dos Campos', moveText: 'Esmaga · move a cada 2 turnos' },
  steed: { name: 'Corcel Sombrio', title: 'Pesadelo do Bosque', moveText: 'Salta em L · esmaga · a cada 2 turnos' },
  malakar: { name: 'Arcebispo Malakar', title: 'O Profeta das Cinzas', moveText: 'Diagonal 1–2 · invoca peões' },
  colossus: { name: 'Colosso de Cerco', title: 'Andarilho do Bastião', moveText: 'Reto 1–2 · terremoto ao redor' },
  dragon: { name: 'Vyrmathra', title: 'A Rainha Dragão', moveText: 'Voa · cospe fogo · invoca cavalos' },
};

export const CARDS_PT: Record<CardId, { name: string; desc: string }> = {
  rewind: { name: 'Voltar', desc: 'Desfaz sua última jogada e a resposta do inimigo' },
  shield: { name: 'Escudo', desc: 'Sua peça bloqueia a próxima captura' },
  time: { name: 'Ampulheta', desc: '+5 turnos' },
  rally: { name: 'Avançar', desc: 'Todos os seus peões avançam uma casa' },
  haste: { name: 'Pressa', desc: 'Move uma peça uma casa e depois joga' },
  freeze: { name: 'Congelar', desc: 'Uma peça inimiga perde 2 turnos' },
  revive: { name: 'Reviver', desc: 'Sua melhor peça perdida volta' },
  promote: { name: 'Coroação', desc: 'Um peão é promovido agora' },
  bounty: { name: 'Recompensa', desc: 'Saque em dobro nesta batalha' },
  insurance: { name: 'Seguro', desc: 'Perdeu? Seus mercenários voltam' },
  reinforce: { name: 'Reforços', desc: 'Traga uma peça do seu exército' },
  stun: { name: 'Atordoar', desc: 'O chefe perde 2 movimentos e o ataque é cancelado' },
  swap: { name: 'Trocar', desc: 'Duas peças suas trocam de lugar' },
  barricade: { name: 'Barricada', desc: 'Coloca uma pedra no tabuleiro' },
  double: { name: 'Jogada Dupla', desc: 'Jogue de novo (sem captura)' },
  teleport: { name: 'Teleporte', desc: 'Leve uma peça para qualquer casa da sua metade' },
  volley: { name: 'Saraivada', desc: 'O primeiro inimigo da coluna cai (chefe: 2 de dano)' },
  smite: { name: 'Castigo', desc: 'Destrói uma peça inimiga' },
};

const KNIGHT_LEAP_PT = 'Também salta como um Cavalo (em L).';
/** Perks are keyed by their English name (shared perks reuse the same name and text). */
export const PERKS_PT: Record<string, { name: string; desc: string }> = {
  'Side step': { name: 'Passo Lateral', desc: 'Também anda 1 casa para os lados (sem capturar).' },
  'Forced march': { name: 'Marcha Forçada', desc: 'Sempre pode andar 2 casas para frente, não só no primeiro lance.' },
  'Spear thrust': { name: 'Golpe de Lança', desc: 'Também captura a peça logo à sua frente.' },
  'Swift crown': { name: 'Coroa Rápida', desc: 'É promovido uma fileira antes (a penúltima).' },
  'Amazon crown': { name: 'Coroa de Amazona', desc: 'É promovido a Amazona (Rainha + Cavalo) em vez de Rainha.' },
  'Long stride': { name: 'Passada Longa', desc: 'Também salta exatamente 2 casas em linha reta.' },
  'Heavy blow': { name: 'Golpe Pesado', desc: '+1 de dano ao atingir um chefe.' },
  'Crushing blow': { name: 'Golpe Esmagador', desc: 'Mais +1 de dano ao atingir um chefe.' },
  'Iron will': { name: 'Vontade de Ferro', desc: 'Sobrevive à primeira captura de cada batalha: o atacante recua.' },
  Vault: { name: 'Salto', desc: 'Ao deslizar, pode pular uma peça e continuar.' },
  'Camel leap': { name: 'Salto do Camelo', desc: 'Também faz um L longo: 3 casas para um lado e 1 para o outro.' },
  Knightrider: { name: 'Cavaleiro Veloz', desc: 'Pode repetir o salto em L na mesma direção, como uma peça que desliza.' },
  'Flank step': { name: 'Passo de Flanco', desc: 'Também anda 1 casa em linha reta (não fica preso a uma cor).' },
  'Corner step': { name: 'Passo de Canto', desc: 'Também anda 1 casa na diagonal.' },
  'Diagonal leap': { name: 'Salto Diagonal', desc: 'Também salta exatamente 2 casas na diagonal.' },
  Cardinal: { name: 'Cardeal', desc: KNIGHT_LEAP_PT },
  Rider: { name: 'Cavaleiro', desc: KNIGHT_LEAP_PT },
  Marshal: { name: 'Marechal', desc: KNIGHT_LEAP_PT },
  Amazon: { name: 'Amazona', desc: KNIGHT_LEAP_PT },
};

export const SKINS_PT: Record<string, string> = {
  'piece:classic': 'Marfim', 'piece:wood': 'Carvalho', 'piece:marble': 'Mármore', 'piece:jade': 'Jade', 'piece:ice': 'Gelo',
  'piece:glass': 'Vidro', 'piece:crystal': 'Cristal', 'piece:gold': 'Ouro', 'piece:lava': 'Lava', 'piece:arcane': 'Arcano',
  'piece:verdant': 'Verdejante', 'piece:shadow': 'Sombra', 'piece:amethyst': 'Ametista', 'piece:bronze': 'Bronze', 'piece:dragonfire': 'Fogo de Dragão',
  'board:realm': 'Reino', 'board:wood': 'Nogueira', 'board:parchment': 'Pergaminho', 'board:marble': 'Mármore', 'board:frost': 'Lago Congelado',
  'board:glass': 'Vidro', 'board:crystal': 'Cristal', 'board:starfield': 'Céu Estrelado', 'board:lava': 'Rocha de Lava',
};

/** Content text for one language. */
export function contentFor(lang: Lang) {
  const pt = lang === 'pt';
  const bossName = (kind: BossKind) => (pt ? BOSSES_PT[kind].name : BOSSES[kind].name);
  return {
    region: (r: RegionDef) => (pt ? REGION_PT[r.id] ?? r.name : r.name),
    regionById: (id: number) => (pt ? REGION_PT[id] : (REGIONS.find((r) => r.id === id) ?? ARENA_THEME).name),
    stage: (s: StageDef): string => {
      if (s.isArena) {
        const level = Number(s.id.split('-')[1]);
        const en = s.name.split(': ').slice(1).join(': ');
        const name = s.boss ? bossName(s.boss.kind) : pt ? ARENA_NAMES_PT[en] ?? en : en;
        return `Arena ${level}: ${name}`;
      }
      if (!pt) return s.name;
      const base = STAGE_BY_ID[baseId(s.id)];
      if (!base) return s.name;
      const n = base.extra ? 9 + base.extra : Number(base.id.split('-')[1]) - 1;
      return STAGES_PT[base.region]?.[n] ?? s.name;
    },
    piece: (t: PieceType) => (pt ? PIECES_PT[t] : PIECES[t].name),
    rank: (r: number) => (pt ? RANKS_PT[r] : RANKS[r]),
    bossName,
    bossMove: (kind: BossKind) => (pt ? BOSSES_PT[kind].moveText : BOSSES[kind].moveText),
    cardName: (id: CardId) => (pt ? CARDS_PT[id].name : CARDS[id].name),
    cardDesc: (id: CardId) => (pt ? CARDS_PT[id].desc : CARDS[id].desc),
    perkName: (p: Perk) => (pt ? PERKS_PT[p.name]?.name ?? p.name : p.name),
    perkDesc: (p: Perk) => (pt ? PERKS_PT[p.name]?.desc ?? p.desc : p.desc),
    skin: (kind: 'piece' | 'board', id: string) =>
      pt ? SKINS_PT[`${kind}:${id}`] ?? id : (kind === 'piece' ? PIECE_SKINS : BOARD_SKINS).find((s) => s.id === id)?.name ?? id,
  };
}
