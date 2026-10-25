/**
 * Role & permission helpers for the CBT teacher/admin dashboard.
 * Roles mirror the `profiles.role` column defined in supabase migrations.
 * Order encodes the permission hierarchy (student < teacher < admin).
 */
export type UserRole = 'student' | 'teacher' | 'admin' | null;

export const ROLE_ORDER: Readonly<Record<NonNullable<UserRole>, number>> = {
  student: 1,
  teacher: 2,
  admin: 3,
} as const;

export const USER_ROLES: ReadonlyArray<NonNullable<UserRole>> = [
  'student',
  'teacher',
  'admin',
] as const;

/** True when `role` is at least `required` in the hierarchy. */
export function hasRole(
  role: UserRole,
  required: NonNullable<UserRole>
): boolean {
  if (!role) return false;
  return ROLE_ORDER[role] >= ROLE_ORDER[required];
}

/** Admin or teacher may manage questions/exams. Students may not. */
export function canManageCurriculum(role: UserRole): boolean {
  return role === 'teacher' || role === 'admin';
}

/** Only admins may manage users/classes. */
export function canManageUsers(role: UserRole): boolean {
  return role === 'admin';
}
