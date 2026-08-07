"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ClassInvigilationTab({ examSessionId }: { examSessionId: string | null }) {
  const router = useRouter();

  if (!examSessionId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Generate seating for this class first — the invigilation roster is generated per exam
          session, after seating exists.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <p className="text-sm text-muted-foreground">
          Invigilation duty is assigned per room across the whole exam session, so it's managed from
          the session page.
        </p>
        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/exam-sessions/${examSessionId}`)}>
          View invigilation roster
        </Button>
      </CardContent>
    </Card>
  );
}
