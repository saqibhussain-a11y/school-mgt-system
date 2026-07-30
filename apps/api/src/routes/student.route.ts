import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { Role } from "@sms/db";
import { studentService } from "../services/student.service";
import { guardianService } from "../services/guardian.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { getAssignedSectionIdsForUser } from "../services/teacherAssignment.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { generateTempPassword } from "../lib/tempPassword";
import {
  createStudentSchema,
  updateStudentSchema,
  linkGuardianSchema,
} from "../validation/student.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN];
const VIEW_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

export const studentRouter = Router();

studentRouter.use(authenticate);

studentRouter.get("/", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const { classId, sectionId } = req.query as { classId?: string; sectionId?: string };

    if (req.user!.role === Role.TEACHER) {
      const assignedSectionIds = await getAssignedSectionIdsForUser(schoolId, req.user!.sub);
      if (sectionId) {
        // Asking for a section they're not assigned to should read as "no results,"
        // not a 403 — the same as any other filter that happens to match nothing.
        const inScope = assignedSectionIds.includes(sectionId);
        res.json(inScope ? await studentService.list(schoolId, { classId, sectionId }) : []);
        return;
      }
      res.json(await studentService.list(schoolId, { classId, sectionIdIn: assignedSectionIds }));
      return;
    }

    res.json(await studentService.list(schoolId, { classId, sectionId }));
  } catch (err) {
    next(err);
  }
});

studentRouter.get("/:id", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const student = await studentService.getById(schoolId, req.params.id);
    if (!student) throw new HttpError(404, "Student not found");

    if (req.user!.role === Role.TEACHER) {
      const assignedSectionIds = await getAssignedSectionIdsForUser(schoolId, req.user!.sub);
      if (!assignedSectionIds.includes(student.sectionId)) {
        throw new HttpError(403, "You do not have permission to perform this action");
      }
    }

    res.json(student);
  } catch (err) {
    next(err);
  }
});

studentRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createStudentSchema),
  async (req, res, next) => {
    try {
      const password = req.body.password ?? generateTempPassword();
      const student = await studentService.create(req.user!.schoolId, {
        ...req.body,
        password,
      });
      res.status(201).json({
        ...student,
        temporaryPassword: req.body.password ? undefined : password,
      });
    } catch (err) {
      next(err);
    }
  },
);

studentRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateStudentSchema),
  async (req, res, next) => {
    try {
      const student = await studentService.update(req.user!.schoolId, req.params.id, req.body);
      if (!student) throw new HttpError(404, "Student not found");
      res.json(student);
    } catch (err) {
      next(err);
    }
  },
);

studentRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const student = await studentService.withdraw(req.user!.schoolId, req.params.id);
    if (!student) throw new HttpError(404, "Student not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

studentRouter.post(
  "/:id/guardians",
  authorize(...ADMIN_ROLES),
  validateBody(linkGuardianSchema),
  async (req, res, next) => {
    try {
      const { guardianId, guardianEmail, relationshipType, isPrimaryContact } = req.body;
      const schoolId = req.user!.schoolId;

      let resolvedGuardianId = guardianId as string | undefined;
      if (guardianEmail) {
        const guardian = await guardianService.findByEmail(schoolId, guardianEmail);
        if (!guardian) throw new HttpError(404, "Guardian not found with that email");
        resolvedGuardianId = guardian.id;
      }

      const link = await studentGuardianService.link(
        schoolId,
        req.params.id,
        resolvedGuardianId!,
        relationshipType,
        isPrimaryContact,
      );
      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  },
);

studentRouter.delete(
  "/:id/guardians/:guardianId",
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const link = await studentGuardianService.unlink(
        req.user!.schoolId,
        req.params.id,
        req.params.guardianId,
      );
      if (!link) throw new HttpError(404, "Guardian link not found");
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

interface BulkImportRow {
  email: string;
  firstName: string;
  lastName: string;
  admissionNo?: string;
  classId: string;
  sectionId: string;
  dob: string;
}

studentRouter.post(
  "/bulk-import",
  authorize(...ADMIN_ROLES),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "CSV file is required (field name: file)");

      const rows = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as BulkImportRow[];

      if (rows.length === 0) throw new HttpError(400, "CSV file has no data rows");

      const errors: { row: number; message: string }[] = [];
      const parsed = rows.map((row, index) => {
        const result = createStudentSchema.safeParse({
          ...row,
          admissionNo: row.admissionNo?.trim() || undefined,
          password: undefined,
        });
        if (!result.success) {
          errors.push({
            row: index + 2, // +1 for header, +1 for 1-based row numbers
            message: result.error.issues.map((i) => i.message).join(", "),
          });
          return null;
        }
        return result.data;
      });

      if (errors.length > 0) {
        throw new HttpError(400, `Invalid rows: ${JSON.stringify(errors)}`);
      }

      const schoolId = req.user!.schoolId;
      const passwords = new Map<number, string>();
      const inputs = parsed.map((row, index) => {
        const password = generateTempPassword();
        passwords.set(index, password);
        return { ...row!, password };
      });

      const created = await studentService.bulkCreate(schoolId, inputs);

      res.status(201).json({
        imported: created.length,
        students: created.map((student, index) => ({
          admissionNo: student.admissionNo,
          email: inputs[index].email,
          temporaryPassword: passwords.get(index),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);
