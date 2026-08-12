-- Partial unique index: at most one ACTIVE loan per (book, student).
-- Not expressible via `@@unique` in schema.prisma (that would forbid a
-- student ever borrowing the same book twice, across RETURNED/LOST history
-- too) — hand-written here, same technique as the exam-subject date
-- uniqueness migration. Backstops the app-level duplicate-loan check against
-- a genuine concurrent double-issue race.
CREATE UNIQUE INDEX "BookLoan_active_book_student_key" ON "BookLoan"("bookId", "studentId") WHERE "status" = 'ACTIVE';
