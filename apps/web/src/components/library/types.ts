export const LOAN_PERIOD_DAYS = 14;
export const FINE_PER_DAY = 0.5;

export type BookLoanStatus = "ACTIVE" | "RETURNED" | "LOST";
export type BookReservationStatus = "PENDING" | "READY" | "FULFILLED" | "CANCELLED";

export interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
}

interface LoanStudent {
  id: string;
  userId: string;
  admissionNo: string;
  user: { firstName: string; lastName: string };
}

interface LoanBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
}

export interface BookLoan {
  id: string;
  bookId: string;
  studentId: string;
  book: LoanBook;
  student: LoanStudent;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  fine: number;
  finePaid: boolean;
  status: BookLoanStatus;
}

export interface BookReservation {
  id: string;
  bookId: string;
  studentId: string;
  book: { id: string; title: string; author: string };
  student: LoanStudent;
  status: BookReservationStatus;
  reservedAt: string;
  notifiedAt: string | null;
}
