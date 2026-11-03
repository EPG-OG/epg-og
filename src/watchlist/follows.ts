import type { Channel, Guide, Programme, RegionKey } from '../epg/types';

/**
 * A followed show. Every future airing that matches is added to the watchlist automatically.
 *   'title'   – this exact show, e.g. "The Great British Bake Off" (from a show's details).
 *   'keyword' – any show whose title contains these words, e.g. "NASCAR" or "Premier League".
 */
export type Follow = {
  id: string;
  kind: 'title' | 'keyword';
  value: string;
  region: RegionKey | 'all';
  createdAt: number;
};

/** Upcoming airings added per follow, so a broad keyword can't flood the watchlist. */
export const MAX_PER_FOLLOW = 8;
/** Phones cap scheduled notifications (iOS at 64), so leave room for manual saves. */
export const MAX_AUTO_ITEMS = 40;

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9À-ɏ]+/g, ' ')
    .trim();

export function matches(follow: Follow, title: string) {
  const t = normalize(title);
  const v = normalize(follow.value);
  if (!v) return false;
  // Keywords match whole words anywhere in the title ("nfl" matches "NFL Football", not "NFLX").
  return follow.kind === 'title' ? t === v : ` ${t} `.includes(` ${v} `);
}

export const followRegions = (follow: Follow): RegionKey[] => (follow.region === 'all' ? ['us', 'uk'] : [follow.region]);

/** Upcoming airings of a follow in one guide, soonest first, one per title and start time. */
export function findAirings(follow: Follow, guide: Guide, now: number) {
  const found: { channel: Channel; programme: Programme }[] = [];
  const seen = new Set<string>();
  for (const category of guide.categories)
    for (const channel of category.channels)
      for (const programme of channel.programmes)
        if (programme.s > now && matches(follow, programme.t)) found.push({ channel, programme });

  found.sort((a, b) => a.programme.s - b.programme.s || a.channel.number - b.channel.number);
  return found
    .filter(({ programme }) => {
      // The same broadcast on two channels (simulcasts) only needs one reminder.
      const k = `${normalize(programme.t)}@${programme.s}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_PER_FOLLOW);
}
