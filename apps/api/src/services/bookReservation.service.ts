import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { inAppNotificationService } from "./inAppNotification.service";
import { studentGuardianService } from "./studentGuardian.service";

const reservationInclude = {
  book: { select: { id: true, title: true, author: true } },
  student: {
    select: { id: true, userId: true, admissionNo: true, user: { select: { firstName: true, lastName: true } } },
  },
};

export const bookReservationService = {
  list(schoolId: string, filters: { studentId?: string; bookId?: string; status?: string } = {}) {
    return prisma.bookReservation.findMany({
      where: {
        schoolId,
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.bookId ? { bookId: filters.bookId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      include: reservationInclude,
      orderBy: { reservedAt: "asc" },
    });
  },

  async create(schoolId: string, data: { bookId: string; studentId: string }) {
    const book = await prisma.book.findFirst({ where: { id: data.bookId, schoolId } });
    if (!book) throw new HttpError(404, "Book not found");
    if (book.availableCopies > 0) {
      throw new HttpError(400, "A copy of this book is available — issue it directly instead of reserving");
    }
    const existing = await prisma.bookReservation.findFirst({
      where: { schoolId, bookId: data.bookId, studentId: data.studentId, status: { in: ["PENDING", "READY"] } },
    });
    if (existing) throw new HttpError(400, "This student already has an active reservation for this book");

    return prisma.bookReservation.create({ data: { schoolId, ...data }, include: reservationInclude });
  },

  getById(schoolId: string, id: string) {
    return prisma.bookReservation.findFirst({ where: { id, schoolId }, include: reservationInclude });
  },

  async cancel(schoolId: string, id: string) {
    const reservation = await prisma.bookReservation.findFirst({ where: { id, schoolId } });
    if (!reservation) return null;
    if (!["PENDING", "READY"].includes(reservation.status)) {
      throw new HttpError(400, "This reservation is no longer active");
    }
    return prisma.bookReservation.update({ where: { id }, data: { status: "CANCELLED" }, include: reservationInclude });
  },

  // Called by bookLoan.service after a return frees up a copy — notifies
  // the oldest still-pending reservation. This is not a hold: whoever
  // physically checks the book out first still gets it (see schema comment).
  async notifyNextInQueue(schoolId: string, bookId: string) {
    const next = await prisma.bookReservation.findFirst({
      where: { schoolId, bookId, status: "PENDING" },
      orderBy: { reservedAt: "asc" },
      include: reservationInclude,
    });
    if (!next) return;

    await prisma.bookReservation.update({ where: { id: next.id }, data: { status: "READY", notifiedAt: new Date() } });
    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [next.studentId]);
    await inAppNotificationService.notifyMany(schoolId, [next.student.userId, ...parentUserIds], {
      type: "library_reservation_ready",
      title: "Reserved book is available",
      body: `"${next.book.title}" is available — visit the library to check it out`,
      link: "/dashboard/library",
    });
  },

  // Called by bookLoan.service.issue when a loan is created for a student
  // who had a pending/ready reservation on that exact book.
  async fulfillIfReserved(schoolId: string, bookId: string, studentId: string) {
    const reservation = await prisma.bookReservation.findFirst({
      where: { schoolId, bookId, studentId, status: { in: ["PENDING", "READY"] } },
    });
    if (!reservation) return;
    await prisma.bookReservation.update({ where: { id: reservation.id }, data: { status: "FULFILLED" } });
  },
};
