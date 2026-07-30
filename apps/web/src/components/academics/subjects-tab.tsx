import { ClassScopedListTab } from "./class-scoped-list-tab";

export function SubjectsTab({ canManage }: { canManage: boolean }) {
  return (
    <ClassScopedListTab
      canManage={canManage}
      apiPath="/api/subjects"
      entityLabel="Subject"
      namePlaceholder="Mathematics"
    />
  );
}
