export const SHARE_AI_STORAGE_PREFIXES = [
  "share-ai:",
  "hr-hunting:",
  "decision-makers:",
  "authority:",
];

export const SHARE_AI_LAST_ACTIVITY_KEY = "share-ai:last-activity";

export function clearShareAiClientState() {
  if (typeof window === "undefined") return;
  clearMatchingStorage(window.sessionStorage);
  clearMatchingStorage(window.localStorage);
}

export function markShareAiActivity(at = Date.now()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHARE_AI_LAST_ACTIVITY_KEY, String(at));
}

export function readShareAiLastActivity() {
  if (typeof window === "undefined") return Date.now();
  const raw = window.localStorage.getItem(SHARE_AI_LAST_ACTIVITY_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

function clearMatchingStorage(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (SHARE_AI_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
}
