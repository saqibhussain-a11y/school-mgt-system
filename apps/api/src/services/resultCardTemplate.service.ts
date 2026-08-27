import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { putObject, deleteObject, getDownloadUrl } from "../lib/storage";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export interface Marker {
  id: string;
  fieldKey: string;
  xRatio: number;
  yRatio: number;
  fontSize?: number;
}

export const resultCardTemplateService = {
  get(schoolId: string) {
    return prisma.resultCardTemplate.findFirst({ where: { schoolId } });
  },

  async getWithDownloadUrl(schoolId: string) {
    const template = await prisma.resultCardTemplate.findFirst({ where: { schoolId } });
    if (!template) return null;
    return { ...template, imageUrl: await getDownloadUrl(template.imageKey) };
  },

  // One template per school — a fresh upload replaces the image but keeps
  // the existing markers (they're stored as ratios, so they still make
  // sense on a re-scanned/re-cropped version of the same physical card;
  // the admin can always re-drag them if the new image doesn't line up).
  async upsertImage(
    schoolId: string,
    file: { buffer: Buffer; filename: string; contentType: string },
  ) {
    const existing = await prisma.resultCardTemplate.findFirst({ where: { schoolId } });
    const key = `schools/${schoolId}/result-card-template/${Date.now()}-${sanitizeFilename(file.filename)}`;
    await putObject(key, file.buffer, file.contentType);
    if (existing) {
      await deleteObject(existing.imageKey).catch(() => {});
      return prisma.resultCardTemplate.update({
        where: { id: existing.id },
        data: { imageKey: key, imageFilename: file.filename },
      });
    }
    return prisma.resultCardTemplate.create({
      data: { schoolId, imageKey: key, imageFilename: file.filename, markers: [] },
    });
  },

  async updateMarkers(schoolId: string, markers: Marker[]) {
    const existing = await prisma.resultCardTemplate.findFirst({ where: { schoolId } });
    if (!existing) throw new HttpError(400, "Upload a template image before placing field markers");
    return prisma.resultCardTemplate.update({ where: { id: existing.id }, data: { markers } });
  },

  async remove(schoolId: string) {
    const existing = await prisma.resultCardTemplate.findFirst({ where: { schoolId } });
    if (!existing) return null;
    await deleteObject(existing.imageKey).catch(() => {});
    await prisma.resultCardTemplate.delete({ where: { id: existing.id } });
    return existing;
  },
};
