import type { Channel, Programme, RegionKey } from '../epg/types';
import { formatTime } from '../time';

// The browser can't send reminders once it's closed, so the browser version offers calendar
// events instead: the person's own calendar shows the alert. Nothing is sent to us.

const utc = (unix: number) => new Date(unix * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Text values in a calendar file escape these characters.
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 characters are folded onto continuation lines that start with a space.
const fold = (line: string) => {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += i ? 74 : 75) parts.push((i ? ' ' : '') + line.slice(i, i ? i + 74 : 75));
  return parts.join('\r\n');
};

function details(region: RegionKey, channel: Channel, p: Programme) {
  return [
    `${channel.number} · ${channel.name} (${region.toUpperCase()}), ${formatTime(p.s)}`,
    p.st,
    p.d,
    'From EPG OG: https://epgog.com/app/',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A calendar file (.ics) for one airing, with an alert `minutesBefore` it starts. */
export function calendarFile(region: RegionKey, channel: Channel, p: Programme, minutesBefore: number) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EPG OG//TV guide//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${channel.id}-${p.s}@epgog.com`,
    `DTSTAMP:${utc(Math.floor(Date.now() / 1000))}`,
    `DTSTART:${utc(p.s)}`,
    `DTEND:${utc(p.e)}`,
    `SUMMARY:${escape(p.t)}`,
    `LOCATION:${escape(`${channel.number} · ${channel.name}`)}`,
    `DESCRIPTION:${escape(details(region, channel, p))}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${minutesBefore}M`,
    `DESCRIPTION:${escape(`${p.t} starts in ${minutesBefore} min on ${channel.name}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Opens the event in the browser's calendar handling: Apple Calendar, Outlook and others. */
export function addToCalendar(region: RegionKey, channel: Channel, p: Programme, minutesBefore: number) {
  const ics = calendarFile(region, channel, p, minutesBefore);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    // iPhone and iPad offer "Add to Calendar" for calendar data opened directly.
    window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    return;
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${p.t.replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'show'}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A link that opens Google Calendar with the airing filled in. Google applies its own default alert. */
export function googleCalendarUrl(region: RegionKey, channel: Channel, p: Programme) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: p.t,
    dates: `${utc(p.s)}/${utc(p.e)}`,
    details: details(region, channel, p),
    location: `${channel.number} · ${channel.name}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
