import type { Programme } from './types';

// Airtime sold to advertisers rather than real shows, plus the UK's end-of-day "Close".
const FILLER = /^(paid program(ming)?|programa pagado|infomercial|teleshopping\b|shop on tv$|shop: |close$)|\bshopping$/i;

export const isFiller = (p: Programme) => FILLER.test(p.t);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sized for the details sheet. `build-epg.mjs` shortens the two common hosts to an image id. */
export function artworkUrl(p: Programme): string | undefined {
  if (!p.i || isFiller(p)) return undefined;
  if (p.i.startsWith('https://')) return p.i;
  if (UUID.test(p.i)) return `https://images.metadata.sky.com/pd-image/${p.i}/16-9/640`;
  return `https://dtil.tmsimg.com/assets/${p.i}.jpg?w=640&h=360`;
}
