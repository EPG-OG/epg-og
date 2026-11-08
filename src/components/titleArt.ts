// Made by a script from the Press Start 2P font (SIL Open Font License) and the two flags:
// one image per letter, so each can hop on its own. Sizes are in points.
import type { RegionKey } from '../epg/types';

export type TitleArt = { width: number; height: number; letters: { image: number; left: number; width: number; height: number }[] };

export const TITLE_ART: Record<RegionKey, TitleArt> = {
  us: { width: 120.9, height: 42.0, letters: [
      { image: require('../../assets/titles/us-0.png'), left: 0.0, width: 42.0, height: 42.0 },
      { image: require('../../assets/titles/us-1.png'), left: 39.4, width: 42.0, height: 42.0 },
      { image: require('../../assets/titles/us-2.png'), left: 78.9, width: 42.0, height: 42.0 },
    ] },
  uk: { width: 81.4, height: 42.0, letters: [
      { image: require('../../assets/titles/uk-0.png'), left: 0.0, width: 42.0, height: 42.0 },
      { image: require('../../assets/titles/uk-1.png'), left: 39.4, width: 42.0, height: 42.0 },
    ] },
};
