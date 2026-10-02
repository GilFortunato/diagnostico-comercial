export const platformModules = [
  "authority.personal",
  "authority.company",
  "authority.leader",
  "content.intelligence",
  "creative.visual-scout",
  "creative.trend-intelligence",
  "decision.makers",
  "hr.hunting",
  "humanship.r1ship",
  "rapport",
  "meeting.intelligence",
] as const;

export type PlatformModule = (typeof platformModules)[number];

// New users enter with only the Diagnóstico Comercial workspace enabled.
// Existing explicit permissions remain authoritative and admins keep full access.
const defaultModuleAccess: Record<PlatformModule, boolean> = {
  "authority.personal": true,
  "authority.company": false,
  "authority.leader": false,
  "content.intelligence": false,
  "creative.visual-scout": false,
  "creative.trend-intelligence": false,
  "decision.makers": false,
  "hr.hunting": false,
  "humanship.r1ship": false,
  rapport: false,
  "meeting.intelligence": false,
};

export function resolveModuleAccess(moduleKey: PlatformModule, explicitValue?: boolean) {
  return explicitValue ?? defaultModuleAccess[moduleKey];
}

export function resolveUserModuleAccess(moduleKey: PlatformModule, policy: { active: boolean; admin: boolean; explicitValue?: boolean }) {
  if (!policy.active) return false;
  if (policy.admin) return true;
  return resolveModuleAccess(moduleKey, policy.explicitValue);
}