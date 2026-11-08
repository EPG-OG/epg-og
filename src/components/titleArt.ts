// Made by a script from the Press Start 2P font (SIL Open Font License) and the two flags. Each image is
// a sprite sheet of the word rippling: 20 frames, 4 to a row with gaps between, then one more of
// it lying flat. Drawn for 3x screens; sizes are in points.
import type { RegionKey } from '../epg/types';

export const TITLE_FRAMES = 20;
export const TITLE_COLUMNS = 4;

export type TitleArt = { image: number; width: number; height: number; pitchX: number; pitchY: number; sheetWidth: number; sheetHeight: number };

export const TITLE_ART: Record<RegionKey, TitleArt> = {
  us: { image: require('../../assets/titles/us.png'), width: 91.667, height: 36.333, pitchX: 93.667, pitchY: 38.333, sheetWidth: 372.667, sheetHeight: 228 },
  uk: { image: require('../../assets/titles/uk.png'), width: 62, height: 36.333, pitchX: 64, pitchY: 38.333, sheetWidth: 254, sheetHeight: 228 },
};
