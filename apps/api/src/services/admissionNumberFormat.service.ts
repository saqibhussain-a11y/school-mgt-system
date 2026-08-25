import { prisma, type PrismaTransactionClient } from "@sms/db";

type TxClient = PrismaTransactionClient;

function format(prefix: string, padWidth: number, n: number) {
  return `${prefix}${String(n).padStart(padWidth, "0")}`;
}

async function getOrCreate(schoolId: string) {
  const existing = await prisma.admissionNumberFormat.findUnique({ where: { schoolId } });
  if (existing) return existing;

  // First-ever read for this school — seed a default that continues
  // whatever the current hardcoded scheme would have produced, so turning
  // this setting on doesn't collide with numbers already issued.
  const prefix = `ADM-${new Date().getFullYear()}-`;
  const count = await prisma.student.count({ where: { schoolId, admissionNo: { startsWith: prefix } } });
  return prisma.admissionNumberFormat.create({
    data: { schoolId, prefix, nextNumber: count + 1, padWidth: 4 },
  });
}

// Best-effort guess at a school's own numbering pattern from a batch of
// explicit admission numbers they just imported (e.g. "AD-543" -> prefix
// "AD-", nextNumber 544, padWidth 3) — never applied automatically, only
// surfaced for the admin to review/edit/confirm once via the settings PATCH.
export function guessFormatFromAdmissionNumbers(admissionNos: string[]) {
  const parsed = admissionNos
    .map((no) => {
      const m = no.match(/^(.*?)(\d+)$/);
      return m ? { prefix: m[1], digits: m[2], value: parseInt(m[2], 10) } : null;
    })
    .filter((p): p is { prefix: string; digits: string; value: number } => p !== null);
  if (parsed.length === 0) return null;

  const groups = new Map<string, { digits: string; value: number }[]>();
  for (const p of parsed) {
    const g = groups.get(p.prefix) ?? [];
    g.push({ digits: p.digits, value: p.value });
    groups.set(p.prefix, g);
  }
  let bestPrefix = "";
  let bestGroup: { digits: string; value: number }[] = [];
  for (const [prefix, g] of groups) {
    if (g.length > bestGroup.length) {
      bestPrefix = prefix;
      bestGroup = g;
    }
  }
  const maxEntry = bestGroup.reduce((a, b) => (b.value > a.value ? b : a));
  return { prefix: bestPrefix, nextNumber: maxEntry.value + 1, padWidth: maxEntry.digits.length };
}

export const admissionNumberFormatService = {
  async exists(schoolId: string) {
    return (await prisma.admissionNumberFormat.findUnique({ where: { schoolId } })) !== null;
  },

  async get(schoolId: string) {
    const fmt = await getOrCreate(schoolId);
    return { ...fmt, suggested: format(fmt.prefix, fmt.padWidth, fmt.nextNumber) };
  },

  async update(schoolId: string, data: { prefix: string; nextNumber: number; padWidth: number }) {
    await getOrCreate(schoolId);
    const fmt = await prisma.admissionNumberFormat.update({ where: { schoolId }, data });
    return { ...fmt, suggested: format(fmt.prefix, fmt.padWidth, fmt.nextNumber) };
  },

  // Peek only — does not consume/increment. The UI prefills a create form
  // with this, the admin can still edit it; consumeNext (below) or
  // advanceIfNeeded is what actually moves the counter forward.
  async suggestNext(schoolId: string) {
    const fmt = await getOrCreate(schoolId);
    return format(fmt.prefix, fmt.padWidth, fmt.nextNumber);
  },

  // Atomically reads-and-increments — used when a caller doesn't supply an
  // explicit admissionNo at all. Locks via the same UPDATE-as-lock
  // technique as fee credit-carry's lockStudentRow, so two concurrent
  // admissions can't both read the same nextNumber before either commits.
  async consumeNext(tx: TxClient, schoolId: string) {
    let fmt = await tx.admissionNumberFormat.findUnique({ where: { schoolId } });
    if (!fmt) {
      const prefix = `ADM-${new Date().getFullYear()}-`;
      const count = await tx.student.count({ where: { schoolId, admissionNo: { startsWith: prefix } } });
      fmt = await tx.admissionNumberFormat.create({ data: { schoolId, prefix, nextNumber: count + 1, padWidth: 4 } });
    }
    const locked = await tx.admissionNumberFormat.update({
      where: { schoolId },
      data: { nextNumber: { increment: 1 } },
    });
    return format(fmt.prefix, fmt.padWidth, locked.nextNumber - 1);
  },

  // When a caller supplies an explicit admissionNo (manual entry, or a
  // bulk-import row) that happens to match this school's current prefix and
  // is numerically >= the counter, bump the counter past it — otherwise the
  // next suggested number would collide with one already taken. An
  // admissionNo that doesn't match the prefix (a genuinely different/legacy
  // number) leaves the counter untouched.
  async advanceIfNeeded(tx: TxClient, schoolId: string, admissionNo: string) {
    const fmt = await tx.admissionNumberFormat.findUnique({ where: { schoolId } });
    if (!fmt || !admissionNo.startsWith(fmt.prefix)) return;
    const rest = admissionNo.slice(fmt.prefix.length);
    if (!/^\d+$/.test(rest)) return;
    const n = parseInt(rest, 10);
    if (n >= fmt.nextNumber) {
      await tx.admissionNumberFormat.update({ where: { schoolId }, data: { nextNumber: n + 1 } });
    }
  },
};
