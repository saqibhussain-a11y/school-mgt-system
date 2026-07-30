import { ClassScopedListTab } from "./class-scoped-list-tab";

export function SectionsTab({ canManage }: { canManage: boolean }) {
  return (
    <ClassScopedListTab
      canManage={canManage}
      apiPath="/api/sections"
      entityLabel="Section"
      namePlaceholder="A"
    />
  );
}
