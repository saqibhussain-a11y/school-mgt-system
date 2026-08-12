import { prisma, Prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { inAppNotificationService } from "./inAppNotification.service";
import { studentGuardianService } from "./studentGuardian.service";
import { bookReservationService } from "./bookReservation.service";
import { LOAN_PERIOD_DAYS, FINE_PER_DAY, MAX_ACTIVE_LOANS_PER_STUDENT } from "../lib/libraryConstants";

const loanInclude = {
  book: { select: { id: true, title: true, author: true, isbn: true } },
  student: {
    select: { id: true, userId: true, admissionNo: true, user: { select: { firstName: true, lastName: true } } },
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysLate(dueDate: Date, returnDate: Date) {
  return Math.max(0, Math.ceil((returnDate.getTime() - dueDate.getTime()) / MS_PER_DAY));
}

export const bookLoanService = {
  list(
    schoolId: string,
    filters: { studentId?: string; bookId?: string; status?: string; overdue?: boolean } = {},
  ) {
    return prisma.bookLoan.findMany({
      where: {
        schoolId,
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.bookId ? { bookId: filters.bookId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.overdue ? { status: "ACTIVE", dueDate: { lt: new Date() } } : {}),
      },
      include: loanInclude,
      orderBy: { issueDate: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.bookLoan.findFirst({ where: { id, schoolId }, include: loanInclude });
  },

  async issue(schoolId: string, data: { bookId: string; studentId: string; issuedByUserId: string }) {
    const [book, student] = await Promise.all([
      prisma.book.findFirst({ where: { id: data.bookId, schoolId } }),
      prisma.student.findFirst({ where: { id: data.studentId, schoolId } }),
    ]);
    if (!book) throw new HttpError(404, "Book not found");
    if (!student) throw new HttpError(404, "Student not found");
    if (student.status !== "ACTIVE") throw new HttpError(400, "Cannot issue a book to a withdrawn student");

    const dueDate = new Date(Date.now() + LOAN_PERIOD_DAYS * MS_PER_DAY);

    let loan;
    try {
      loan = await prisma.$transaction(async (tx) => {
        const activeLoanCount = await tx.bookLoan.count({
          where: { schoolId, studentId: data.studentId, status: "ACTIVE" },
        });
        if (activeLoanCount >= MAX_ACTIVE_LOANS_PER_STUDENT) {
          throw new HttpError(400, `This student already has the maximum of ${MAX_ACTIVE_LOANS_PER_STUDENT} books on loan`);
        }

        // Atomic conditional decrement, not read-then-write — the only real guard
        // against two concurrent issues of the last copy both succeeding and
        // taking availableCopies negative.
        const decremented = await tx.book.updateMany({
          where: { id: data.bookId, schoolId, availableCopies: { gt: 0 } },
          data: { availableCopies: { decrement: 1 } },
        });
        if (decremented.count === 0) {
          throw new HttpError(400, "No copies of this book are currently available");
        }

        // Duplicate-active-loan protection is the BookLoan_active_book_student_key
        // partial unique index, not a pre-check — a pre-check here would have the
        // same TOCTOU gap it's meant to close.
        return tx.bookLoan.create({
          data: { schoolId, bookId: data.bookId, studentId: data.studentId, dueDate, issuedByUserId: data.issuedByUserId },
          include: loanInclude,
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new HttpError(400, "This student already has this book on loan");
      }
      throw err;
    }

    await bookReservationService.fulfillIfReserved(schoolId, data.bookId, data.studentId);
    return loan;
  },

  async returnLoan(schoolId: string, id: string, data: { lost?: boolean } = {}) {
    const loan = await prisma.bookLoan.findFirst({ where: { id, schoolId }, include: { book: true } });
    if (!loan) throw new HttpError(404, "Loan not found");

    if (data.lost) {
      const updated = await prisma.$transaction(async (tx) => {
        // Guard on status: "ACTIVE" in the write itself, not a stale read done
        // above — two concurrent returns/loses of the same loan must not both
        // succeed and double-adjust the book's copy counts.
        const closed = await tx.bookLoan.updateMany({
          where: { id, schoolId, status: "ACTIVE" },
          data: { status: "LOST", returnDate: new Date() },
        });
        if (closed.count === 0) throw new HttpError(400, "This loan has already been closed");
        await tx.book.update({ where: { id: loan.bookId }, data: { totalCopies: { decrement: 1 } } });
        return tx.bookLoan.findUniqueOrThrow({ where: { id }, include: loanInclude });
      });
      return updated;
    }

    const returnDate = new Date();
    const lateDays = daysLate(loan.dueDate, returnDate);
    const fine = Math.round(lateDays * FINE_PER_DAY * 100) / 100;

    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.bookLoan.updateMany({
        where: { id, schoolId, status: "ACTIVE" },
        data: { status: "RETURNED", returnDate, fine },
      });
      if (closed.count === 0) throw new HttpError(400, "This loan has already been closed");
      await tx.book.update({ where: { id: loan.bookId }, data: { availableCopies: { increment: 1 } } });
      return tx.bookLoan.findUniqueOrThrow({ where: { id }, include: loanInclude });
    });

    await bookReservationService.notifyNextInQueue(schoolId, loan.bookId);
    return updated;
  },

  async markFinePaid(schoolId: string, id: string) {
    const loan = await prisma.bookLoan.findFirst({ where: { id, schoolId } });
    if (!loan) return null;
    return prisma.bookLoan.update({ where: { id }, data: { finePaid: true }, include: loanInclude });
  },

  async remind(schoolId: string, id: string) {
    const loan = await prisma.bookLoan.findFirst({ where: { id, schoolId }, include: loanInclude });
    if (!loan) throw new HttpError(404, "Loan not found");
    if (loan.status !== "ACTIVE" || loan.dueDate >= new Date()) {
      throw new HttpError(400, "This loan is not overdue");
    }

    const lateDays = daysLate(loan.dueDate, new Date());
    const estimatedFine = Math.round(lateDays * FINE_PER_DAY * 100) / 100;
    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [loan.studentId]);
    await inAppNotificationService.notifyMany(schoolId, [loan.student.userId, ...parentUserIds], {
      type: "library_overdue",
      title: "Overdue library book",
      body: `"${loan.book.title}" is ${lateDays} day${lateDays === 1 ? "" : "s"} overdue — estimated fine: ${estimatedFine}`,
      link: "/dashboard/library",
    });
  },
};
