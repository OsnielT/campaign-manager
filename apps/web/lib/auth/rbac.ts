export type Role = "owner" | "editor" | "viewer";

const ROLE_ORDER: Role[] = ["viewer", "editor", "owner"];

export interface OrgMember {
  role: string;
}

/**
 * Throws a 403-shaped error if the member's role is below the minimum required.
 * Call this in API routes after loading the membership row.
 */
export function requireRole(member: OrgMember, minRole: Role): void {
  const memberLevel = ROLE_ORDER.indexOf(member.role as Role);
  const requiredLevel = ROLE_ORDER.indexOf(minRole);
  if (memberLevel < 0 || memberLevel < requiredLevel) {
    const err = new Error(`Requires role: ${minRole}`);
    (err as NodeJS.ErrnoException).code = "FORBIDDEN";
    throw err;
  }
}

export function hasRole(member: OrgMember, minRole: Role): boolean {
  const memberLevel = ROLE_ORDER.indexOf(member.role as Role);
  const requiredLevel = ROLE_ORDER.indexOf(minRole);
  return memberLevel >= 0 && memberLevel >= requiredLevel;
}
