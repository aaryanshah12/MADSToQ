import type { SessionUser } from "../schemas/session";

const ROLE_RANK: Record<SessionUser["role"], number> = {
  VIEWER: 1,
  OPERATOR: 2,
  MANAGER: 3,
  ADMIN: 4,
  OWNER: 5,
};

export function hasMinimumRole(user: SessionUser, minimum: SessionUser["role"]): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}

export function canManageUsers(user: SessionUser): boolean {
  return hasMinimumRole(user, "ADMIN");
}
