import { Router } from "express";
import { Role } from "@sms/db";
import { bookLoanService } from "../services/bookLoan.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { LIBRARY_MANAGE_ROLES } from "./libraryBook.route";
import { issueBookSchema, returnBookSchema } from "../validation/library.schema";

async function assertCanViewStudentLibrary(schoolId: string, user: { sub: string; role: string }, studentId: string) {
  if (LIBRARY_MANAGE_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) return;
  if (user.role === Role.PARENT && (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))) {
    return;
  }
  throw new HttpError(403, "You do not have permission to view these library records");
}

export const bookLoanRouter = Router();
bookLoanRouter.use(authenticate);

bookLoanRouter.get("/", authorize(...LIBRARY_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { bookId, status, overdue } = req.query as { bookId?: string; status?: string; overdue?: string };
    res.json(await bookLoanService.list(req.user!.schoolId, { bookId, status, overdue: overdue === "true" }));
  } catch (err) {
    next(err);
  }
});

bookLoanRouter.get("/me", authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const student = await studentService.getByUserId(schoolId, req.user!.sub);
    if (!student) throw new HttpError(404, "No student profile linked to this account");
    res.json(await bookLoanService.list(schoolId, { studentId: student.id }));
  } catch (err) {
    next(err);
  }
});

bookLoanRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanViewStudentLibrary(schoolId, req.user!, req.params.studentId);
    res.json(await bookLoanService.list(schoolId, { studentId: req.params.studentId }));
  } catch (err) {
    next(err);
  }
});

bookLoanRouter.post("/", authorize(...LIBRARY_MANAGE_ROLES), validateBody(issueBookSchema), async (req, res, next) => {
  try {
    const loan = await bookLoanService.issue(req.user!.schoolId, { ...req.body, issuedByUserId: req.user!.sub });
    res.status(201).json(loan);
  } catch (err) {
    next(err);
  }
});

bookLoanRouter.post(
  "/:id/return",
  authorize(...LIBRARY_MANAGE_ROLES),
  validateBody(returnBookSchema),
  async (req, res, next) => {
    try {
      res.json(await bookLoanService.returnLoan(req.user!.schoolId, req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

bookLoanRouter.post("/:id/fine-paid", authorize(...LIBRARY_MANAGE_ROLES), async (req, res, next) => {
  try {
    const loan = await bookLoanService.markFinePaid(req.user!.schoolId, req.params.id);
    if (!loan) throw new HttpError(404, "Loan not found");
    res.json(loan);
  } catch (err) {
    next(err);
  }
});

bookLoanRouter.post("/:id/remind", authorize(...LIBRARY_MANAGE_ROLES), async (req, res, next) => {
  try {
    await bookLoanService.remind(req.user!.schoolId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
