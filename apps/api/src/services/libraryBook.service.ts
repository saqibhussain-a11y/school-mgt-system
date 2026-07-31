import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const libraryBookService = {
  list(schoolId: string, filters: { query?: string; category?: string } = {}) {
    const { query, category } = filters;
    return prisma.book.findMany({
      where: {
        schoolId,
        ...(category ? { category } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { author: { contains: query, mode: "insensitive" } },
                { isbn: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { title: "asc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.book.findFirst({ where: { id, schoolId } });
  },

  create(
    schoolId: string,
    data: { isbn?: string; title: string; author: string; category?: string; totalCopies: number },
  ) {
    return prisma.book.create({ data: { schoolId, ...data, availableCopies: data.totalCopies } });
  },

  // Shrinking totalCopies below what's currently on loan would leave
  // availableCopies negative, so the floor is copies-on-loan, not zero.
  async update(
    schoolId: string,
    id: string,
    data: { isbn?: string; title: string; author: string; category?: string; totalCopies: number },
  ) {
    const existing = await prisma.book.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    const onLoan = existing.totalCopies - existing.availableCopies;
    if (data.totalCopies < onLoan) {
      throw new HttpError(400, `Cannot reduce total copies below ${onLoan}, the number currently on loan`);
    }
    return prisma.book.update({
      where: { id },
      data: { ...data, availableCopies: data.totalCopies - onLoan },
    });
  },

  // Blocked once any loan (even a returned one) or reservation exists — not
  // just active loans. A returned loan is still historical/audit data (fine
  // paid or not), and the FK would reject the delete anyway; same "history
  // stays intact" rule as FeeStructure/IssuedDocument.
  async remove(schoolId: string, id: string) {
    const existing = await prisma.book.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { loans: true, reservations: true } } },
    });
    if (!existing) return null;
    if (existing._count.loans > 0) {
      throw new HttpError(400, "Cannot delete a book that has any loan history — it currently has copies on loan or has been borrowed before");
    }
    if (existing._count.reservations > 0) {
      throw new HttpError(400, "Cannot delete a book that has reservation history");
    }
    await prisma.book.delete({ where: { id } });
    return existing;
  },
};
