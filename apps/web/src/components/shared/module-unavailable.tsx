import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function ModuleUnavailable({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Lock className="size-6 text-muted-foreground" />
          <p className="font-medium">{title} isn&apos;t available for your account</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Either it isn&apos;t enabled for your school, or your role doesn&apos;t have access to it. Contact your
            school administrator if you think you should see it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
