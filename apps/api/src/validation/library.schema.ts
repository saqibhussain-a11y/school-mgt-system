import { z } from "zod";

export const createBookSchema = z.object({
  isbn: z.string().optional(),
  title: z.string().min(1),
  author: z.string().min(1),
  category: z.string().optional(),
  totalCopies: z.number().int().positive(),
});

export const updateBookSchema = z.object({
  isbn: z.string().optional(),
  title: z.string().min(1),
  author: z.string().min(1),
  category: z.string().optional(),
  totalCopies: z.number().int().positive(),
});

export const issueBookSchema = z.object({
  bookId: z.string().min(1),
  studentId: z.string().min(1),
});

export const returnBookSchema = z.object({
  lost: z.boolean().optional(),
});

export const createReservationSchema = z.object({
  bookId: z.string().min(1),
  studentId: z.string().min(1),
});
