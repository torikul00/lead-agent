import multer from "multer";
import { buildObjectKey, uploadBufferToR2 } from "../utils/r2.js";

/** Maps logical upload type → cloud "folder", filename prefix, size limit, and optional MIME allowlist. */
const KIND_CONFIG = {
   avatar: {
      subdir: "avatar",
      filenamePrefix: "avatar-",
      maxBytes: 2 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
   },
   instructor: {
      subdir: "instructor",
      filenamePrefix: "instructor-",
      maxBytes: 2 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
   },
   course: {
      subdir: "course",
      filenamePrefix: "course-",
      maxBytes: 5 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
   },
   review: {
      subdir: "review",
      filenamePrefix: "review-",
      maxBytes: 2 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
   },
   // Batch resource files. For now only images, PDFs and plain-text files.
   // Stored under <bucket>/resources/<batchId>/ — see `perBatch` below.
   resource: {
      subdir: "resources",
      filenamePrefix: "resource-",
      maxBytes: 25 * 1024 * 1024,
      mimeTypes: [
         "image/jpeg",
         "image/jpg",
         "image/png",
         "image/webp",
         "image/gif",
         "application/pdf",
         "text/plain",
      ],
      errorHint: "Only image, PDF, or TXT files are allowed.",
      // Nest each upload inside a folder named after the batch id.
      perBatch: true,
   },
   // Per-question images for exams. Images only. Stored under
   // <bucket>/exams/<batchId>/ — see `perBatch` below.
   exam: {
      subdir: "exams",
      filenamePrefix: "exam-",
      maxBytes: 5 * 1024 * 1024,
      mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
      errorHint: "Only image files are allowed.",
      perBatch: true,
   },
};

function makeMimeFilter(mimeTypes, errorHint) {
   return (req, file, cb) => {
      if (mimeTypes.includes(file.mimetype)) {
         cb(null, true);
      } else {
         const hint =
            errorHint ||
            (mimeTypes.includes("application/pdf") &&
            mimeTypes.some((m) => m.startsWith("image/"))
               ? "Only JPG, PNG, or PDF files are allowed."
               : "Invalid file type.");
         cb(new Error(hint), false);
      }
   };
}

// Resolve the batch id for a per-batch upload from the route params or body.
function resolveBatchId(req) {
   return req.params?.batchId || req.params?.batch_id || req.body?.batch_id;
}

/**
 * Multer middleware for a single file field. Parses the upload into memory,
 * then streams it straight to Cloudflare R2 under the same folder layout the
 * old disk storage used (e.g. `avatar/…`, `resources/<batchId>/…`).
 *
 * On success `req.file` gains:
 *   - `key`      — the R2 object key (e.g. `resources/<batchId>/resource-169…-42.pdf`)
 *   - `filename` — the key's basename, kept for backward compatibility
 *   - `url`      — the public R2 URL to store on the document
 *
 * @param {Object} opts
 * @param {'avatar'|'instructor'|'course'|'review'|'resource'|'exam'} opts.kind
 * @param {string} [opts.fieldName] — default: `avatar` | `image` (course) | `file` (resource) | `avatar` (others)
 * @returns {import('express').RequestHandler} a middleware with multer's own
 *          `(req, res, callback)` shape, so `withUploadErrorHandling` keeps working.
 */
export function createFileUploadMiddleware({ kind, fieldName } = {}) {
   if (!kind || !KIND_CONFIG[kind]) {
      throw new Error(
         "createFileUploadMiddleware({ kind }) requires kind: 'avatar' | 'instructor' | 'course' | 'review' | 'resource' | 'exam'"
      );
   }
   const cfg = KIND_CONFIG[kind];
   const field =
      fieldName ??
      (kind === "course"
         ? "image"
         : kind === "resource"
         ? "file"
         : "avatar");

   const fileFilter = makeMimeFilter(cfg.mimeTypes, cfg.errorHint);

   const parseSingle = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: cfg.maxBytes },
      fileFilter,
   }).single(field);

   return (req, res, callback) => {
      parseSingle(req, res, async (err) => {
         if (err) return callback(err);
         if (!req.file) return callback();

         let batchId;
         if (cfg.perBatch) {
            batchId = resolveBatchId(req);
            if (!batchId) {
               return callback(new Error("A batch id is required to upload this file."));
            }
         }

         try {
            const key = buildObjectKey({
               subdir: cfg.subdir,
               batchId,
               prefix: cfg.filenamePrefix,
               originalname: req.file.originalname,
            });
            const url = await uploadBufferToR2({
               buffer: req.file.buffer,
               key,
               contentType: req.file.mimetype,
            });
            req.file.key = key;
            req.file.filename = key.split("/").pop();
            req.file.url = url;
            callback();
         } catch (uploadErr) {
            callback(uploadErr);
         }
      });
   };
}

/**
 * Multer middleware for a single in-memory file (kept in `req.file.buffer`, never
 * uploaded automatically). Use for transient uploads such as a generated invoice PDF
 * that is emailed and discarded, or a file the controller wants to process itself
 * before deciding whether/where to persist it.
 *
 * @param {Object} opts
 * @param {string} opts.fieldName — form field name (e.g. `invoice_pdf`)
 * @param {number} [opts.maxBytes] — size limit (default 10 MB)
 * @param {string[]} [opts.mimeTypes] — optional MIME allowlist
 * @returns {import('express').RequestHandler}
 */
export function createMemoryUploadMiddleware({
   fieldName,
   maxBytes = 10 * 1024 * 1024,
   mimeTypes,
} = {}) {
   if (!fieldName) {
      throw new Error("createMemoryUploadMiddleware({ fieldName }) requires a fieldName");
   }
   const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxBytes },
      fileFilter: Array.isArray(mimeTypes) ? makeMimeFilter(mimeTypes) : undefined,
   });
   return upload.single(fieldName);
}

/**
 * Wraps a multer single-file middleware so errors return JSON 400 instead of hanging.
 */
export function withUploadErrorHandling(uploadMw) {
   return (req, res, next) => {
      uploadMw(req, res, (err) => {
         if (err) {
            return res.status(400).json({
               error: err.message || "File upload failed",
            });
         }
         next();
      });
   };
}
