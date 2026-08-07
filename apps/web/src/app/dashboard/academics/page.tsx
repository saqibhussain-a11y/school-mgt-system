"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionsTab } from "@/components/academics/sessions-tab";
import { ClassesTab } from "@/components/academics/classes-tab";
import { SectionsTab } from "@/components/academics/sections-tab";
import { SubjectsTab } from "@/components/academics/subjects-tab";
import { RoomsTab } from "@/components/academics/rooms-tab";
import { PeriodsTab } from "@/components/academics/periods-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicsPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader title="Academics" description="Sessions, classes, sections, and subjects" />
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="classes" className="mt-4">
          <ClassesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="sections" className="mt-4">
          <SectionsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="subjects" className="mt-4">
          <SubjectsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="rooms" className="mt-4">
          <RoomsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodsTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
