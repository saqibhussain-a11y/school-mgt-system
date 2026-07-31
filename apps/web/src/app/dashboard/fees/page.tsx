"use client";

import { PageHeader } from "@/components/layout/page-header";
import { FeeStructuresTab } from "@/components/fees/fee-structures-tab";
import { FeeInvoicesTab } from "@/components/fees/fee-invoices-tab";
import { MyFeesView } from "@/components/fees/my-fees-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

const FEE_MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

export default function FeesPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (FEE_MANAGE_ROLES.includes(user.role)) {
    return (
      <div>
        <PageHeader title="Fees" description="Fee structures, invoices, and collection reports" />
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices & reports</TabsTrigger>
            <TabsTrigger value="structures">Fee structures</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices">
            <FeeInvoicesTab />
          </TabsContent>
          <TabsContent value="structures">
            <FeeStructuresTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Fees" description="Your invoices and payment history" />
      <MyFeesView />
    </div>
  );
}
