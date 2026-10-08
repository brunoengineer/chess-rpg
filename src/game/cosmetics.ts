export interface Skin {
  id: string;
  name: string;
  /** 0 = free. */
  price: number;
  /** Earned instead of bought: all 30 stars in this world. */
  earnedWorld?: number;
}

/** Skins for all of your pieces. Visuals live in styles.css under [data-skin="…"]. */
export const PIECE_SKINS: Skin[] = [
  { id: 'classic', name: 'Ivory', price: 0 },
  { id: 'wood', name: 'Oak', price: 1500 },
  { id: 'marble', name: 'Marble', price: 2500 },
  { id: 'jade', name: 'Jade', price: 3500 },
  { id: 'ice', name: 'Ice', price: 4500 },
  { id: 'glass', name: 'Glass', price: 5500 },
  { id: 'crystal', name: 'Crystal', price: 7000 },
  { id: 'gold', name: 'Gold', price: 9000 },
  { id: 'lava', name: 'Lava', price: 11000 },
  { id: 'arcane', name: 'Arcane', price: 13000 },
  { id: 'verdant', name: 'Verdant', price: 0, earnedWorld: 1 },
  { id: 'shadow', name: 'Shadow', price: 0, earnedWorld: 2 },
  { id: 'amethyst', name: 'Amethyst', price: 0, earnedWorld: 3 },
  { id: 'bronze', name: 'Bronze', price: 0, earnedWorld: 4 },
  { id: 'dragonfire', name: 'Dragonfire', price: 0, earnedWorld: 5 },
];

/** Board skins. 'realm' keeps each world's own colors. */
export const BOARD_SKINS: Skin[] = [
  { id: 'realm', name: 'Realm', price: 0 },
  { id: 'wood', name: 'Walnut', price: 1500 },
  { id: 'parchment', name: 'Parchment', price: 2500 },
  { id: 'marble', name: 'Marble', price: 3500 },
  { id: 'frost', name: 'Frozen Lake', price: 5000 },
  { id: 'glass', name: 'Glass', price: 6500 },
  { id: 'crystal', name: 'Crystal', price: 8000 },
  { id: 'starfield', name: 'Starfield', price: 10000 },
  { id: 'lava', name: 'Lava Rock', price: 12000 },
];

export const skinKey = (kind: 'piece' | 'board', id: string) => `${kind}:${id}`;
