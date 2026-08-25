export type OrgRole = "owner" | "admin" | "member" | "viewer";

export type DocAction =
  | "read"
  | "write"
  | "scan"
  | "manage_members"
  | "manage_keys";

const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canPerform(role: OrgRole, action: DocAction): boolean {
  switch (action) {
    case "read":
      return roleAtLeast(role, "viewer");
    case "write":
    case "scan":
      return roleAtLeast(role, "member");
    case "manage_keys":
      return roleAtLeast(role, "member");
    case "manage_members":
      return roleAtLeast(role, "admin");
    default:
      return false;
  }
}

export const ORG_ROLES: OrgRole[] = ["owner", "admin", "member", "viewer"];
