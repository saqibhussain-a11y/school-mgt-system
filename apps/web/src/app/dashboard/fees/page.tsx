"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { FeeStructuresTab } from "@/components/fees/fee-structures-tab";
import { FeeInvoicesTab } from "@/components/fees/fee-invoices-tab";
import { ScholarshipsTab } from "@/components/fees/scholarships-tab";
import { MyFeesView } from "@/components/fees/my-fees-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

const FEE_MANAGE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

// Stripe redirects the browser back here after checkout — success_url/
// cancel_url in feeInvoice.service.ts's createCheckoutSession. This is
// purely a UX signal, NOT proof of payment: the webhook (the only thing
// that actually calls recordPayment) can land a moment before or after
// this redirect, so the invoice's balance may not have updated yet.
function CheckoutStatusToast() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Payment submitted — it can take a few seconds to reflect on the invoice.");
    } else if (checkout === "cancelled") {
      toast.info("Checkout was cancelled — no payment was made.");
    }
    if (checkout) {
      router.replace("/dashboard/fees");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

function FeesPageContent() {
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
            <TabsTrigger value="scholarships">Scholarships</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices">
            <FeeInvoicesTab />
          </TabsContent>
          <TabsContent value="structures">
            <FeeStructuresTab />
          </TabsContent>
          <TabsContent value="scholarships">
            <ScholarshipsTab />
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

export default function FeesPage() {
  return (
    <>
      <Suspense>
        <CheckoutStatusToast />
      </Suspense>
      <FeesPageContent />
    </>
  );
}
