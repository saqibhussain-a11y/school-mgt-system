"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayslipsTab } from "@/components/payroll/payslips-tab";
import { SalariesTab } from "@/components/payroll/salaries-tab";
import { MyPayslipsView } from "@/components/payroll/my-payslips-view";
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

export default function PayrollPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = ADMIN_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={isAdmin ? "Generate and manage staff payslips" : "Your salary and payslip history"}
      />

      {isAdmin ? (
        <Tabs defaultValue="payslips">
          <TabsList>
            <TabsTrigger value="payslips">Payslips</TabsTrigger>
            <TabsTrigger value="salaries">Salaries</TabsTrigger>
          </TabsList>
          <TabsContent value="payslips" className="mt-4">
            <PayslipsTab />
          </TabsContent>
          <TabsContent value="salaries" className="mt-4">
            <SalariesTab />
          </TabsContent>
        </Tabs>
      ) : (
        <MyPayslipsView />
      )}
    </div>
  );
}
