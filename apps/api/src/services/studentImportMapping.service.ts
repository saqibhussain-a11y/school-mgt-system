import { prisma } from "@sms/db";

export const studentImportMappingService = {
  async get(schoolId: string): Promise<Record<string, string | null> | null> {
    const row = await prisma.studentImportMapping.findUnique({ where: { schoolId } });
    return (row?.mapping as Record<string, string | null> | undefined) ?? null;
  },

  async save(schoolId: string, mapping: Record<string, string | null>) {
    await prisma.studentImportMapping.upsert({
      where: { schoolId },
      update: { mapping },
      create: { schoolId, mapping },
    });
  },
};
