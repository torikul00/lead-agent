import path from "path";
import {
   S3Client,
   PutObjectCommand,
   DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const {
   R2_ACCOUNT_ID,
   R2_ACCESS_KEY_ID,
   R2_SECRET_ACCESS_KEY,
   R2_BUCKET_NAME,
   R2_PUBLIC_URL,
} = process.env;

const PUBLIC_BASE = (R2_PUBLIC_URL || "").replace(/\/+$/, "");

export const r2Client = new S3Client({
   region: "auto",
   endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
   credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
   },
});

/**
 * Builds an object key that mirrors the folder layout previously used on
 * local disk: <subdir>/[<batchId>/]<prefix><timestamp>-<random><ext>
 *
 * @param {Object} opts
 * @param {string} opts.subdir — top-level "folder", e.g. `avatar`, `resources`
 * @param {string|number} [opts.batchId] — nests the key one level deeper, e.g. `resources/<batchId>/...`
 * @param {string} [opts.prefix] — filename prefix, e.g. `avatar-`
 * @param {string} [opts.originalname] — original uploaded filename, used only for its extension
 */
export function buildObjectKey({ subdir, batchId, prefix = "", originalname = "" }) {
   const ext = path.extname(originalname);
   const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
   const filename = `${prefix}${uniqueSuffix}${ext}`;
   return batchId ? `${subdir}/${batchId}/${filename}` : `${subdir}/${filename}`;
}

/** Public URL a browser can load directly for a given object key. */
export function publicUrlForKey(key) {
   return `${PUBLIC_BASE}/${key}`;
}

/** Recovers the object key from a URL previously built by `publicUrlForKey`. */
export function keyFromPublicUrl(url) {
   if (!url || !PUBLIC_BASE || !url.startsWith(`${PUBLIC_BASE}/`)) return null;
   return url.slice(PUBLIC_BASE.length + 1);
}

/**
 * Uploads a buffer to the R2 bucket under `key` and returns its public URL.
 *
 * @param {Object} opts
 * @param {Buffer} opts.buffer
 * @param {string} opts.key
 * @param {string} [opts.contentType]
 */
export async function uploadBufferToR2({ buffer, key, contentType }) {
   await r2Client.send(
      new PutObjectCommand({
         Bucket: R2_BUCKET_NAME,
         Key: key,
         Body: buffer,
         ContentType: contentType || "application/octet-stream",
      })
   );
   return publicUrlForKey(key);
}

/** Deletes an object from the bucket, ignoring "already gone" / network errors. */
export async function deleteFromR2(key) {
   if (!key) return;
   try {
      await r2Client.send(
         new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
      );
   } catch {
      // best-effort cleanup — a stray object in the bucket is harmless
   }
}
