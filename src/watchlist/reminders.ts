import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatTime } from '../time';

export const REMINDER_MINUTES = 5;
const CHANNEL_ID = 'show-reminders';

// Local notifications only exist on iOS/Android; on web the watchlist still works without them.
export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelReady: Promise<unknown> | undefined;

export async function ensureReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  if (Platform.OS === 'android') {
    channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Show reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await channelReady;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type ReminderInput = { title: string; channelName: string; channelNumber: number; start: number };

/** Schedules a reminder REMINDER_MINUTES before `start`. Returns the notification id, or undefined if none was scheduled. */
export async function scheduleReminder({ title, channelName, channelNumber, start }: ReminderInput) {
  const nowMs = Date.now();
  if (start * 1000 <= nowMs + 10_000) return undefined; // already started
  if (!(await ensureReminderPermission())) return undefined;

  // If the show starts within the reminder window, remind at least a few seconds from now.
  const fireAt = Math.max(start * 1000 - REMINDER_MINUTES * 60_000, nowMs + 5_000);
  const minutes = Math.max(1, Math.round((start * 1000 - fireAt) / 60_000));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${title} starts in ${minutes} min`,
      body: `${channelNumber} · ${channelName} at ${formatTime(start)}`,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
  });
}

export async function cancelReminder(id?: string) {
  if (!id || !remindersSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or cleared by the OS.
  }
}
