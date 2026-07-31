import { Router } from "express";
import { Role } from "@sms/db";
import { libraryBookService } from "../services/libraryBook.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createBookSchema, updateBookSchema } from "../validation/library.schema";

export const LIBRARY_MANAGE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.LIBRARIAN];

export const libraryBookRouter = Router();
libraryBookRouter.use(authenticate);

// Catalog browsing is open to any authenticated user (students/parents need
// it to find and reserve a book) — only create/update/delete are gated.
libraryBookRouter.get("/", async (req, res, next) => {
  try {
    const { query, category } = req.query as { query?: string; category?: string };
    res.json(await libraryBookService.list(req.user!.schoolId, { query, category }));
  } catch (err) {
    next(err);
  }
});

libraryBookRouter.get("/:id", async (req, res, next) => {
  try {
    const book = await libraryBookService.getById(req.user!.schoolId, req.params.id);
    if (!book) throw new HttpError(404, "Book not found");
    res.json(book);
  } catch (err) {
    next(err);
  }
});

libraryBookRouter.post("/", authorize(...LIBRARY_MANAGE_ROLES), validateBody(createBookSchema), async (req, res, next) => {
  try {
    res.status(201).json(await libraryBookService.create(req.user!.schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

libraryBookRouter.patch(
  "/:id",
  authorize(...LIBRARY_MANAGE_ROLES),
  validateBody(updateBookSchema),
  async (req, res, next) => {
    try {
      const book = await libraryBookService.update(req.user!.schoolId, req.params.id, req.body);
      if (!book) throw new HttpError(404, "Book not found");
      res.json(book);
    } catch (err) {
      next(err);
    }
  },
);

libraryBookRouter.delete("/:id", authorize(...LIBRARY_MANAGE_ROLES), async (req, res, next) => {
  try {
    const book = await libraryBookService.remove(req.user!.schoolId, req.params.id);
    if (!book) throw new HttpError(404, "Book not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
