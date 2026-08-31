export function isLinkedInProfileUrl(value: string) {
  try {
    const url = new URL(value);
    return /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/in\//i.test(url.pathname);
  } catch {
    return false;
  }
}
