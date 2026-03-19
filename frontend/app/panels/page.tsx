"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PanelsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[50vh] text-white/60">
      Redirecting to switch panels…
    </div>
  );
}
