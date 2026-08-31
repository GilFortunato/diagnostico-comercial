export const platformModules = [
  "authority.personal",
  "authority.company",
  "authority.leader",
  "content.intelligence",
  "decision.makers",
  "rapport",
  "meeting.intelligence",
] as const;

export type PlatformModule = (typeof platformModules)[number];

const defaultModuleAccess: Record<PlatformModule, boolean> = {
  "authority.personal": true,
  "authority.company": false,
  "authority.leader": false,
  "content.intelligence": true,
  "decision.makers": true,
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
