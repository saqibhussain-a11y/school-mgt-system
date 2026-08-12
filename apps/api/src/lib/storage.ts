import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Cloudflare R2 (S3-compatible) in production; when R2 env vars are unset
// (local dev), fall back to writing straight to disk under apps/api/uploads/
// — same "real cloud service when configured, working fallback otherwise"
// pattern as the mailer's Ethereal fallback. Never used once R2 is set.
const bucket = process.env.R2_BUCKET_NAME;
const configured = Boolean(
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && bucket,
);

const client = configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const LOCAL_DIR = path.join(process.cwd(), "uploads");
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";
// Local-fallback downloads happen via a plain browser navigation
// (window.open), which never carries the app's Authorization header —
// same reason R2 presigned URLs embed their own signature instead of
// relying on a header. This mirrors that: a short-lived HMAC over
// key+expiry, verified in localUpload.route.ts without needing auth
// middleware at all.
const LOCAL_LINK_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-local-storage-secret";

export function signLocalDownload(key: string, expiresAt: number, forceDownload = false) {
  // forceDownload is part of the signed payload, not a trailing query param
  // read independently — otherwise a client could strip `dl=1` from an
  // otherwise-valid signed URL to force inline rendering of a file this
  // link was deliberately generated to force-download.
  return crypto
    .createHmac("sha256", LOCAL_LINK_SECRET)
    .update(`${key}:${expiresAt}:${forceDownload ? "1" : "0"}`)
    .digest("hex");
}

export function isObjectStorageConfigured() {
  return configured;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (client) {
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return;
  }
  const filePath = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
}

// Short-lived (5 min) — generated fresh on each request, never stored.
// Downloads always happen via a browser navigation (window.open), not a
// cross-origin fetch, so this needs no CORS configuration on the bucket.
// forceDownload: true is for untrusted, user-uploaded content (assignment
// attachments/submissions) — forces the browser to download rather than
// render inline, the real defense against a spoofed .html/.svg (one that
// got past the upload-time extension filter, or whose stored ContentType
// came straight from an attacker-controlled multer mimetype) executing as a
// page instead of downloading as a file. Left false for server-generated,
// fully-trusted PDFs (certificates) where the product deliberately opens
// them inline in a new tab — see generate-certificate-dialog.tsx.
export async function getDownloadUrl(key: string, options: { forceDownload?: boolean } = {}) {
  const forceDownload = options.forceDownload ?? false;
  if (client) {
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(forceDownload ? { ResponseContentDisposition: "attachment" } : {}),
      }),
      { expiresIn: 300 },
    );
  }
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const sig = signLocalDownload(key, expiresAt, forceDownload);
  const dl = forceDownload ? "&dl=1" : "";
  return `${API_BASE_URL}/api/uploads/local?key=${encodeURIComponent(key)}&exp=${expiresAt}&sig=${sig}${dl}`;
}

export async function deleteObject(key: string) {
  if (client) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, key), { force: true });
}

export function readLocalFile(key: string) {
  return path.join(LOCAL_DIR, key);
}
