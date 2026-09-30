import type { Request, Response, NextFunction } from "express";
import type { Role } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { schoolService } from "../services/school.service";
import type { ModuleKey } from "../config/modules";
import { MODULE_LABELS } from "../config/modules";

export async function assertModuleEnabled(schoolId: string, moduleKey: ModuleKey) {
  const enabledModules = await schoolService.getEnabledModules(schoolId);
  if (!enabledModules.includes(moduleKey)) {
    throw new HttpError(
      403,
      `${MODULE_LABELS[moduleKey]} is not enabled for your school. Contact your platform administrator to turn it on.`,
      "MODULE_DISABLED",
    );
  }
}

// Route-level gate for a not-yet-built module (e.g. `payrollRouter.use(requireModule("PAYROLL"))`)
// — same shape as authorize() in auth.middleware.ts, applied after authenticate.
export function requireModule(moduleKey: ModuleKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    assertModuleEnabled(req.user!.schoolId, moduleKey).then(() => next(), next);
  };
}

export async function assertModuleRoleAllowed(schoolId: string, moduleKey: ModuleKey, role: Role) {
  const roles = await schoolService.getEffectiveModuleRoles(schoolId, moduleKey);
  if (!roles.includes(role)) {
    throw new HttpError(403, `Your role doesn't have access to ${MODULE_LABELS[moduleKey]} at this school.`);
  }
}

// Narrower, per-role gate layered on top of requireModule() — checks the
// school's own moduleRoleOverrides (falling back to the module's fixed
// ceiling) rather than a hardcoded role list, so a School Admin can shrink
// who sees a module without a code change. Always apply after
// requireModule(), not instead of it: this only decides *which roles* of an
// *already-enabled* module get through, it says nothing about enablement.
export function requireModuleRoleAccess(moduleKey: ModuleKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    assertModuleRoleAllowed(req.user!.schoolId, moduleKey, req.user!.role as Role).then(() => next(), next);
  };
}
