import { File, Paths } from 'expo-file-system';
import type { Guide, RegionKey } from './types';

const fileFor = (region: RegionKey) => new File(Paths.document, `guide-${region}.json`);

/** The listings saved by the last download, if there are any and they're readable. */
export async function readSavedGuide(region: RegionKey): Promise<Guide | undefined> {
  try {
    const file = fileFor(region);
    return file.exists ? (JSON.parse(await file.text()) as Guide) : undefined;
  } catch {
    return undefined;
  }
}

export async function writeSavedGuide(region: RegionKey, json: string): Promise<void> {
  try {
    await fileFor(region).write(json);
  } catch {
    // Out of space, say: the app still has the listings it just downloaded.
  }
}
