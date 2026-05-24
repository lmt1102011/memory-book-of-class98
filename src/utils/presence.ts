export type PresenceFields = {
  onlineAt?: string;
  lastSeenAt?: string;
};

export const ONLINE_WINDOW_MS = 1000 * 60 * 2;

export const presenceTime = (person: PresenceFields) =>
  Date.parse(person.onlineAt || person.lastSeenAt || '');

export const isRecentlyOnline = (person: PresenceFields) => {
  const lastActive = presenceTime(person);
  return Number.isFinite(lastActive) && Date.now() - lastActive < ONLINE_WINDOW_MS;
};
