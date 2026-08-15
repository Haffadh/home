"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredRole } from "@/lib/roles";

/**
 * Client-side role guard for a whole surface.
 *
 * Two rules make this safe to drop into a page that must not change:
 *
 * 1. **Deny only on positive evidence.** A missing or unrecognised stored role
 *    is *not* a denial — it renders normally and the server has the last word.
 *    The opposite (redirect unless proven allowed) would sign the shared staff
 *    tablet out of its own panel if its localStorage ever lost `shh_role`
 *    while keeping the token, and that panel is the one that must never break.
 * 2. **The allowed path costs nothing.** For a role that belongs here the hook
 *    returns `false` on every render and never sets state, so the page renders,
 *    mounts and animates exactly as it did before the guard existed.
 *
 * This is UX, not access control: it puts a family member somewhere sensible
 * instead of showing them an error. The enforcement is `requireRole` on the
 * endpoints, which holds regardless of what the browser believes.
 *
 * Pass a module-level `allowedRoles` constant, not an inline array — it is an
 * effect dependency.
 */
export function useRoleGuard(
  allowedRoles: readonly string[],
  redirectTo: string
): boolean {
  const router = useRouter();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isRoleDenied(allowedRoles)) return;
    setDenied(true);
    router.replace(redirectTo);
  }, [router, redirectTo, allowedRoles]);

  return denied;
}

/**
 * The same decision, synchronously and without a render.
 *
 * Effects fire in hook order but all of them run before React processes the
 * state they set, so a `denied` flag cannot stop a data-loading effect in the
 * same commit. Loaders call this directly instead, which keeps a family
 * member's browser from firing the staff fetches at all on the way out.
 */
export function isRoleDenied(allowedRoles: readonly string[]): boolean {
  const role = getStoredRole();
  if (!role) return false;
  return !allowedRoles.includes(role);
}
