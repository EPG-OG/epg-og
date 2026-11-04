export type RegionKey = 'us' | 'uk';

// Field names are kept short because the JSON is downloaded on every launch.
export type Programme = {
  s: number; // start, unix seconds
  e: number; // end, unix seconds
  t: string; // title
  st?: string; // sub-title / episode
  d?: string; // description
  c?: string; // category
  n?: 1; // new / premiere
  l?: 1; // live
  i?: string; // artwork: an image id or full URL (see programme.ts)
};

/** Visible area of a padded logo image: [x, y, width, height, imageWidth, imageHeight] in pixels. */
export type LogoCrop = [number, number, number, number, number, number];

export type Channel = {
  id: string;
  number: number;
  name: string;
  logo?: string;
  lc?: LogoCrop;
  dl?: 1; // logo is too dark for the guide's background: show it on a light backing
  programmes: Programme[];
};

export type Category = {
  id: string;
  name: string;
  channels: Channel[];
};

export type Guide = {
  region: RegionKey;
  label: string;
  generatedAt: number;
  from: number;
  to: number;
  categories: Category[];
};
