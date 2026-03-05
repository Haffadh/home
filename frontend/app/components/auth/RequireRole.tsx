"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "../../lib/roles";
import { getStoredRole, ROLE_DEFAULT_ROUTE } from "../../lib/roles";

type RequireRoleProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
};

export default function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const role = getStoredRole();
    if (!role) {
      router.replace("/login");
      return;
    }
    if (!allowedRoles.includes(role)) {
      router.replace(ROLE_DEFAULT_ROUTE[role]);
      return;
    }
    setAllowed(true);
  }, [router]);

  if (allowed !== true) return null;
  return <>{children}</>;
}
