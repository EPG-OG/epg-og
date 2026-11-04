import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { showTipJar } from './distribution';

export type WhatsNewEntry = {
  /** Counts up with each entry. Over-the-air updates keep the same app version, so this is what marks an entry as seen. */
  id: number;
  title: string;
  items: { icon: ComponentProps<typeof Ionicons>['name']; text: string }[];
};

// Newest first. Add an entry at the top for each update people would notice, and it pops up
// once on their next launch. Bug fixes and listings changes don't need one.
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: 1,
    title: 'Version 1.0.4',
    items: [
      { icon: 'cloud-offline-outline', text: 'Works offline: the latest listings are saved on your phone' },
      { icon: 'image-outline', text: 'Show artwork in the details, and paid programming is dimmed so real shows stand out' },
      { icon: 'time-outline', text: 'Jump to Now, Tonight or Tomorrow. The guide now runs two days ahead' },
      { icon: 'notifications-outline', text: 'Choose your reminder time at the top of the Watchlist: 5, 15 or 30 minutes before' },
      { icon: 'albums-outline', text: 'Each guide reopens on the category you last used' },
      { icon: 'mail-outline', text: `Something not working? Tell us from the ${showTipJar ? 'Buy Me a Coffee' : 'About'} tab` },
    ],
  },
];
