import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { Role } from "@sms/db";
import { studentService } from "../services/student.service";
import { guardianService } from "../services/guardian.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { getAssignedSectionIdsForUser } from "../services/teacherAssignment.service";
import { notificationService } from "../services/notification.service";
import { studentImportMappingService } from "../services/studentImportMapping.service";
import { admissionNumberFormatService, guessFormatFromAdmissionNumbers } from "../services/admissionNumberFormat.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { parsePagination } from "../lib/pagination";
import {
  createStudentSchema,
  updateStudentSchema,
  linkGuardianSchema,
  generateCredentialsSchema,
} from "../validation/student.schema";


const ADMIN_ROLES = [Role.SCHOOL_ADMIN];
const VIEW_ROLES = [
  Role.SCHOOL_ADMIN,
  Role.PRINCIPAL,
  Role.TEACHER,
  Role.LIBRARIAN,
  Role.TRANSPORT_MANAGER,
  Role.ACCOUNTANT,
];

const ALLOWED_IMPORT_EXTENSIONS = new Set([".csv"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMPORT_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      cb(new HttpError(400, "This file type isn't allowed for student bulk import"));
      return;
    }
    cb(null, true);
  },
});

export const studentRouter = Router();

studentRouter.use(authenticate);

studentRouter.get("/", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const { classId, sectionId, search } = req.query as { classId?: string; sectionId?: string; search?: string };
    const pagination = parsePagination(req.query as Record<string, unknown>);

    if (req.user!.role === Role.TEACHER) {
      const assignedSectionIds = await getAssignedSectionIdsForUser(schoolId, req.user!.sub);
      if (sectionId) {
        const inScope = assignedSectionIds.includes(sectionId);
        if (!inScope) {
          res.json(pagination ? { data: [], total: 0, page: pagination.page, pageSize: pagination.pageSize } : []);
          return;
        }
        const filters = { classId, sectionId, search };
        res.json(pagination ? await studentService.listPaginated(schoolId, filters, pagination) : await studentService.list(schoolId, filters));
        return;
      }
      const filters = { classId, sectionIdIn: assignedSectionIds, search };
      res.json(pagination ? await studentService.listPaginated(schoolId, filters, pagination) : await studentService.list(schoolId, filters));
      return;
    }

    const filters = { classId, sectionId, search };
    res.json(pagination ? await studentService.listPaginated(schoolId, filters, pagination) : await studentService.list(schoolId, filters));
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
      const student = await studentService.create(req.user!.schoolId, req.body);
      res.status(201).json(student);
    } catch (err) {
      next(err);
    }
  },
);

const CREDENTIAL_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

studentRouter.post(
  "/:id/generate-credentials",
  authorize(...CREDENTIAL_ROLES),
  validateBody(generateCredentialsSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      if (req.body.mode === "ADMIN_SET") {
        const result = await studentService.generateCredentialsAdminSet(schoolId, req.params.id);
        if (!result) throw new HttpError(404, "Student not found");
        await notificationService.notifyNewAccount(result.email, result.firstName, result.password);
        res.json({ mode: "ADMIN_SET", email: result.email, temporaryPassword: result.password });
      } else {
        const result = await studentService.generateCredentialsInvite(schoolId, req.params.id);
        if (!result) throw new HttpError(404, "Student not found");
        await notificationService.notifyAccountInvite(schoolId, result.email, result.firstName, result.otp);
        res.json({ mode: "SELF_SERVICE", email: result.email });
      }
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

const KNOWN_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "admissionNo",
  "className",
  "sectionName",
  "dob",
  "previousSchool",
  "medicalInfo",
] as const;
type KnownField = (typeof KNOWN_FIELDS)[number];

const HEADER_ALIASES: Record<string, KnownField> = {
  email: "email",
  emailaddress: "email",
  firstname: "firstName",
  fname: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  lname: "lastName",
  surname: "lastName",
  familyname: "lastName",
  admissionno: "admissionNo",
  admissionnumber: "admissionNo",
  rollno: "admissionNo",
  rollnumber: "admissionNo",
  class: "className",
  classname: "className",
  grade: "className",
  section: "sectionName",
  sectionname: "sectionName",
  dob: "dob",
  dateofbirth: "dob",
  birthdate: "dob",
  previousschool: "previousSchool",
  lastschool: "previousSchool",
  medicalinfo: "medicalInfo",
  medicalinformation: "medicalInfo",
  medicalnotes: "medicalInfo",
};

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(buffer: Buffer): Record<string, string>[] {
  const rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, "CSV file has no data rows");
  return rows as Record<string, string>[];
}

studentRouter.post(
  "/bulk-import/preview",
  authorize(...ADMIN_ROLES),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "CSV file is required (field name: file)");
      const rows = parseCsv(req.file.buffer);
      const headers = Object.keys(rows[0]);
      const savedMapping = await studentImportMappingService.get(req.user!.schoolId);

      const suggestedMapping: Record<string, KnownField | null> = {};
      for (const header of headers) {
        const saved = savedMapping?.[header];
        if (saved && (KNOWN_FIELDS as readonly string[]).includes(saved)) {
          suggestedMapping[header] = saved as KnownField;
        } else {
          suggestedMapping[header] = HEADER_ALIASES[normalizeHeader(header)] ?? null;
        }
      }

      res.json({
        headers,
        knownFields: KNOWN_FIELDS,
        suggestedMapping,
        rowCount: rows.length,
        sampleRows: rows.slice(0, 3),
      });
    } catch (err) {
      next(err);
    }
  },
);

studentRouter.post(
  "/bulk-import",
  authorize(...ADMIN_ROLES),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "CSV file is required (field name: file)");
      let mapping: Record<string, KnownField | null>;
      try {
        mapping = JSON.parse(req.body.mapping ?? "");
      } catch {
        throw new HttpError(400, "mapping field is required and must be JSON");
      }

      const rows = parseCsv(req.file.buffer);
      const schoolId = req.user!.schoolId;

      const { inputs, errors } = await studentService.resolveBulkImportRows(schoolId, rows, mapping);

      if (errors.length > 0) {
        throw new HttpError(400, `Invalid rows: ${JSON.stringify(errors)}`);
      }

      const explicitAdmissionNos = inputs.map((i) => i.admissionNo).filter((n): n is string => !!n);
      const [created, formatAlreadyCustomized] = await Promise.all([
        studentService.bulkCreate(schoolId, inputs),
        admissionNumberFormatService.exists(schoolId),
      ]);

      await studentImportMappingService.save(schoolId, mapping);

      const suggestedFormat =
        !formatAlreadyCustomized && explicitAdmissionNos.length > 0
          ? guessFormatFromAdmissionNumbers(explicitAdmissionNos)
          : null;

      res.status(201).json({
        imported: created.length,
        students: created.map((student) => ({ admissionNo: student.admissionNo, email: student.user.email })),
        suggestedFormat,
      });
    } catch (err) {
      next(err);
    }
  },
);
