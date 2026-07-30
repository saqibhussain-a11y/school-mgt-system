import { UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function GuardiansPage() {
  return (
    <div>
      <PageHeader title="Guardians" description="Manage parent and guardian accounts" />
      <ComingSoon title="Guardian directory" icon={UsersRound} />
    </div>
  );
}
