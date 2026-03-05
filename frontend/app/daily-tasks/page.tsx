"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DailyTasksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/todays-tasks");
  }, [router]);
  return (
    <div className="p-4 md:p-8 text-white/70 text-center">
      Redirecting to Today&apos;s Tasks…
    </div>
  );
}
