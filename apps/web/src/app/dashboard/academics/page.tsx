"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AcademicsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/academics/sessions");
  }, [router]);

  return null;
}
