import { Router } from "express";
import { Role } from "@sms/db";
import { documentIssuanceService } from "../services/documentIssuance.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { generateDocumentSchema } from "../validation/document.schema";

// Official documents (transfer/character certificates carry legal weight) —
// issuance is restricted to admin roles, narrower than most staff-facing
// modules, same reasoning as Fees (see FEE_MANAGE_ROLES).
const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

async function assertCanViewStudentDocs(schoolId: string, user: { sub: string; role: string }, studentId: string) {
  if (ADMIN_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) return;
  if (
    user.role === Role.PARENT &&
    (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))
  ) {
    return;
  }
  throw new HttpError(403, "You do not have permission to view these documents");
}

export const documentRouter = Router();
documentRouter.use(authenticate);

documentRouter.get("/", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const { studentId, type } = req.query as { studentId?: string; type?: string };
    res.json(await documentIssuanceService.list(req.user!.schoolId, { studentId, type }));
  } catch (err) {
    next(err);
  }
});

documentRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanViewStudentDocs(schoolId, req.user!, req.params.studentId);
    res.json(await documentIssuanceService.list(schoolId, { studentId: req.params.studentId }));
  } catch (err) {
    next(err);
  }
});

documentRouter.post("/generate", authorize(...ADMIN_ROLES), validateBody(generateDocumentSchema), async (req, res, next) => {
  try {
    const document = await documentIssuanceService.generate(req.user!.schoolId, {
      ...req.body,
      issuedByUserId: req.user!.sub,
    });
    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

documentRouter.get("/:id/download-url", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const document = await documentIssuanceService.getById(schoolId, req.params.id);
    if (!document) throw new HttpError(404, "Document not found");
    await assertCanViewStudentDocs(schoolId, req.user!, document.studentId);
    res.json({ url: await documentIssuanceService.getDownloadUrl(schoolId, req.params.id) });
  } catch (err) {
    next(err);
  }
});

documentRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const document = await documentIssuanceService.remove(req.user!.schoolId, req.params.id);
    if (!document) throw new HttpError(404, "Document not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
