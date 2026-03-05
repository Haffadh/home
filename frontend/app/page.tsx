"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("shh_role");

    if (!role) {
      router.replace("/login");
      return;
    }

    const routes = {
      admin: "/panel/admin",
      member: "/panel/member",
      cleaner: "/panel/cleaner",
      viewer: "/panel/viewer",
    };

    const target = routes[role];
    if (target) {
      router.replace(target);
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
