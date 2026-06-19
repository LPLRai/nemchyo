// WhatsApp-style mute durations.
export const MUTE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
  { label: 'Until I turn it back on', minutes: -1 }, // far-future sentinel
];

const FOREVER = '2999-12-31T00:00:00Z';

// The value to store in chat_members.muted_until for a given duration.
export function muteUntilValue(minutes: number): string {
  const ms = minutes < 0 ? Date.parse(FOREVER) : Date.now() + minutes * 60000;
  return new Date(ms).toISOString();
}

export function isMuted(mutedUntil?: string): boolean {
  if (!mutedUntil) return false;
  const t = Date.parse(String(mutedUntil).replace(' ', 'T'));
  return !isNaN(t) && t > Date.now();
}

export function isForever(mutedUntil?: string): boolean {
  if (!mutedUntil) return false;
  const t = Date.parse(String(mutedUntil).replace(' ', 'T'));
  return !isNaN(t) && t > Date.parse('2900-01-01T00:00:00Z');
}

// Short human label for how long a mute lasts (for the chat header).
export function muteLabel(mutedUntil?: string): string {
  if (!isMuted(mutedUntil)) return '';
  if (isForever(mutedUntil)) return 'Muted';
  const t = Date.parse(String(mutedUntil).replace(' ', 'T'));
  const mins = Math.max(1, Math.round((t - Date.now()) / 60000));
  if (mins < 60) return `Muted ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Muted ${hrs}h`;
  return `Muted ${Math.round(hrs / 24)}d`;
}
