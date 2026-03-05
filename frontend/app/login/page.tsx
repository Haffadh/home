"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { ROLE_LABELS, ROLE_DEFAULT_ROUTE, STORAGE_KEY } from "@/lib/roles";

const ROLES: Role[] = ["admin", "member", "cleaner", "viewer"];

export default function LoginPage() {
  const router = useRouter();

  function selectRole(role: Role) {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, role);
    }
    router.push(ROLE_DEFAULT_ROUTE[role]);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-xl font-semibold text-white/90 tracking-tight mb-2">
        Choose your panel
      </h1>
      <p className="text-[0.8125rem] text-white/50 mb-6">Select a role to continue</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => selectRole(role)}
            className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-[0.9375rem] font-medium text-white/90 transition-all duration-300 ease-out hover:bg-white/15 hover:scale-[1.02]"
          >
            {ROLE_LABELS[role]}
          </button>
        ))}
      </div>
    </div>
  );
}
