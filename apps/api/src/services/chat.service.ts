import { prisma, ChatMessageRole } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { attendanceService } from "./attendance.service";
import { feeInvoiceService } from "./feeInvoice.service";
import { studentGuardianService } from "./studentGuardian.service";
import { announcementService, buildAnnouncementViewer } from "./announcement.service";
import { getLlmProvider, type LlmMessage } from "../lib/llm";

const HISTORY_LIMIT = 20;
const MAX_MESSAGE_LENGTH = 2000;
const ATTENDANCE_WINDOW_DAYS = 30;

const SYSTEM_PROMPT =
  "You are a helpful assistant for parents and students of a school. You answer questions about " +
  "their own fees, attendance, and school announcements. You are given the requester's current data " +
  "as JSON below — use ONLY that data to answer. If something is asked that isn't in the data (for " +
  "example homework, timetable, or exam results), say plainly that you don't have that information " +
  "right now rather than guessing. Keep answers short, friendly, and in plain language. Never invent " +
  "a fee amount, balance, or percentage that isn't in the data you were given.";

async function buildStudentContext(schoolId: string, studentId: string, name: string) {
  const [invoices, credit, attendance] = await Promise.all([
    feeInvoiceService.listForStudent(schoolId, studentId),
    feeInvoiceService.getCreditBalance(schoolId, studentId),
    attendanceService.getSummaryForStudent(
      schoolId,
      studentId,
      new Date(Date.now() - ATTENDANCE_WINDOW_DAYS * 86_400_000),
      new Date(),
    ),
  ]);

  return {
    name,
    feeInvoices: invoices.map((i) => ({
      category: i.feeStructure.category,
      period: i.period,
      netAmount: i.netAmount,
      balance: i.balance,
      status: i.status,
      dueDate: i.dueDate,
    })),
    feeCreditBalance: credit.creditBalance,
    attendancePercentLast30Days: attendance.percentage,
  };
}

export const chatService = {
  async getHistory(schoolId: string, userId: string) {
    const rows = await prisma.chatMessage.findMany({
      where: { schoolId, userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
    return rows.reverse();
  },

  // Rebuilds the requester's fees/attendance/announcements fresh on every
  // turn rather than reusing whatever was fetched for a prior message in
  // the same conversation — a balance that just got paid, or an
  // announcement posted a minute ago, must never be answered from a stale
  // snapshot.
  async sendMessage(schoolId: string, user: { sub: string; role: string }, content: string) {
    const trimmed = content.trim();
    if (!trimmed) throw new HttpError(400, "Message cannot be empty");
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
    }

    const contextParts: Record<string, unknown> = {};

    if (user.role === "STUDENT") {
      const student = await prisma.student.findFirst({
        where: { schoolId, userId: user.sub },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (student) {
        contextParts.student = await buildStudentContext(
          schoolId,
          student.id,
          `${student.user.firstName} ${student.user.lastName}`,
        );
      }
    } else if (user.role === "PARENT") {
      const children = await studentGuardianService.getChildrenForGuardianUser(schoolId, user.sub);
      contextParts.children = await Promise.all(
        children.map((c) => buildStudentContext(schoolId, c.id, `${c.user.firstName} ${c.user.lastName}`)),
      );
    }

    const viewer = await buildAnnouncementViewer(schoolId, user);
    const announcements = await announcementService.list(schoolId, viewer, 5);
    contextParts.recentAnnouncements = announcements.map((a) => ({
      title: a.title,
      body: a.body,
      postedAt: a.createdAt,
    }));

    const history = await this.getHistory(schoolId, user.sub);

    const messages: LlmMessage[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent data (JSON):\n${JSON.stringify(contextParts).slice(0, 8000)}` },
      ...history.map(
        (h): LlmMessage => ({ role: h.role === ChatMessageRole.USER ? "user" : "assistant", content: h.content }),
      ),
      { role: "user", content: trimmed },
    ];

    const provider = getLlmProvider();
    const reply = await provider.chat(messages);

    const [, assistantMessage] = await prisma.$transaction([
      prisma.chatMessage.create({ data: { schoolId, userId: user.sub, role: ChatMessageRole.USER, content: trimmed } }),
      prisma.chatMessage.create({ data: { schoolId, userId: user.sub, role: ChatMessageRole.ASSISTANT, content: reply } }),
    ]);

    return assistantMessage;
  },

  async clearHistory(schoolId: string, userId: string) {
    await prisma.chatMessage.deleteMany({ where: { schoolId, userId } });
  },
};
