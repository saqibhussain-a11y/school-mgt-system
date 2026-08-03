"use client";

import { PageHeader } from "@/components/layout/page-header";
import { VehiclesTab } from "@/components/transport/vehicles-tab";
import { RoutesTab } from "@/components/transport/routes-tab";
import { MyTransportView } from "@/components/transport/my-transport-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

const TRANSPORT_MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER"];

export default function TransportPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (TRANSPORT_MANAGE_ROLES.includes(user.role)) {
    return (
      <div>
        <PageHeader title="Transport" description="Vehicles, routes, and student assignments" />
        <Tabs defaultValue="routes">
          <TabsList>
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          </TabsList>
          <TabsContent value="routes">
            <RoutesTab />
          </TabsContent>
          <TabsContent value="vehicles">
            <VehiclesTab />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Transport" description="Your assigned route and vehicle" />
      <MyTransportView />
    </div>
  );
}
