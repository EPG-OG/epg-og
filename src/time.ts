const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const formatTime = (unix: number) => timeFmt.format(new Date(unix * 1000));

export const formatDay = (unix: number) => dayFmt.format(new Date(unix * 1000));

export const formatRange = (s: number, e: number) => `${formatTime(s)} – ${formatTime(e)}`;

export function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} hr ${m % 60} min` : `${h} hr`;
}

export const floorToHalfHour = (unix: number) => unix - (unix % 1800);
