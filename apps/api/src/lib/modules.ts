import type { Request, Response, NextFunction } from "express";
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
