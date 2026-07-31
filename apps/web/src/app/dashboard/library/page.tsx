"use client";

import { PageHeader } from "@/components/layout/page-header";
import { BooksTab } from "@/components/library/books-tab";
import { LoansTab } from "@/components/library/loans-tab";
import { ReservationsTab } from "@/components/library/reservations-tab";
import { MyLibraryView } from "@/components/library/my-library-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

const LIBRARY_MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"];

export default function LibraryPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (LIBRARY_MANAGE_ROLES.includes(user.role)) {
    return (
      <div>
        <PageHeader title="Library" description="Book catalog, loans, and reservations" />
        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="reservations">Reservations</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog">
            <BooksTab />
          </TabsContent>
          <TabsContent value="loans">
            <LoansTab />
          </TabsContent>
          <TabsContent value="reservations">
            <ReservationsTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Library" description="Your borrowed books and reservations" />
      <MyLibraryView />
    </div>
  );
}
