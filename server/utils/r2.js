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


export function keyFromPublicUrl(url) {
   if (!url || !PUBLIC_BASE || !url.startsWith(`${PUBLIC_BASE}/`)) return null;
   return url.slice(PUBLIC_BASE.length + 1);
}


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
