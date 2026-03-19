"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_DEFAULT_ROUTE, getStoredRole } from "@/lib/roles";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const role = getStoredRole();

    if (!role) {
      router.replace("/login");
      return;
    }

    const target = ROLE_DEFAULT_ROUTE[role as keyof typeof ROLE_DEFAULT_ROUTE];
    if (target) {
      router.replace(target);
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
