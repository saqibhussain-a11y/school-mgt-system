import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { prisma, Role } from "@sms/db";
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
import {
  createStudentSchema,
  updateStudentSchema,
  linkGuardianSchema,
  generateCredentialsSchema,
  bulkImportRowSchema,
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
        await notificationService.notifyAccountInvite(result.email, result.firstName, result.otp);
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

      const errors: { row: number; message: string }[] = [];
      const classSectionCache = new Map<string, { classId: string; sectionId: string } | null>();

      async function resolveClassSection(className: string, sectionName: string) {
        const key = `${className.toLowerCase()}::${sectionName.toLowerCase()}`;
        if (classSectionCache.has(key)) return classSectionCache.get(key)!;
        const cls = await prisma.class.findFirst({
          where: { schoolId, name: { equals: className, mode: "insensitive" } },
        });
        const section = cls
          ? await prisma.section.findFirst({
              where: { schoolId, classId: cls.id, name: { equals: sectionName, mode: "insensitive" } },
            })
          : null;
        const resolved = cls && section ? { classId: cls.id, sectionId: section.id } : null;
        classSectionCache.set(key, resolved);
        return resolved;
      }

      const inputs: Parameters<typeof studentService.bulkCreate>[1] = [];
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const rowNumber = index + 2; // +1 for header, +1 for 1-based row numbers
        const mapped: Record<string, string> = {};
        const extraInfo: Record<string, string> = {};
        for (const [header, value] of Object.entries(row)) {
          const target = mapping[header];
          if (target) mapped[target] = value;
          else if (value) extraInfo[header] = value;
        }
        if (mapped.admissionNo !== undefined) {
          const trimmed = mapped.admissionNo.trim();
          if (trimmed) mapped.admissionNo = trimmed;
          else delete mapped.admissionNo;
        }

        const result = bulkImportRowSchema.safeParse(mapped);
        if (!result.success) {
          errors.push({ row: rowNumber, message: result.error.issues.map((i) => i.message).join(", ") });
          continue;
        }

        const resolved = await resolveClassSection(result.data.className, result.data.sectionName);
        if (!resolved) {
          errors.push({
            row: rowNumber,
            message: `Class "${result.data.className}" / section "${result.data.sectionName}" not found`,
          });
          continue;
        }

        inputs.push({
          email: result.data.email,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          admissionNo: result.data.admissionNo,
          classId: resolved.classId,
          sectionId: resolved.sectionId,
          dob: result.data.dob,
          previousSchool: result.data.previousSchool,
          medicalInfo: result.data.medicalInfo,
          extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
        });
      }

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
