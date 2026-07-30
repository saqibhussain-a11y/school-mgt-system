import { prisma } from "@sms/db";

export const holidayService = {
  list(schoolId: string) {
    return prisma.holiday.findMany({ where: { schoolId }, orderBy: { date: "asc" } });
  },

  isHoliday(schoolId: string, date: Date) {
    return prisma.holiday.findUnique({ where: { schoolId_date: { schoolId, date } } });
  },

  create(schoolId: string, data: { date: Date; name: string }) {
    return prisma.holiday.create({ data: { ...data, schoolId } });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.holiday.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.holiday.delete({ where: { id } });
  },
};
