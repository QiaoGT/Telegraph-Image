import {
  createObjectKey,
  guessMimeTypeFromName,
  sanitizeFilename,
} from "../../_lib/storage";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.FILE_BUCKET) {
    return Response.json(
      { error: "R2 bucket binding FILE_BUCKET is required." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const originalName = sanitizeFilename(body?.filename || "") || `file-${crypto.randomUUID()}.bin`;
  const fileSize = Number(body?.size || 0);
  const fileType = (originalName.split(".").pop() || "").toLowerCase();
  const contentType =
    body?.contentType || guessMimeTypeFromName(originalName) || "application/octet-stream";
  const key = await createObjectKey(env, originalName);

  const mp = await env.FILE_BUCKET.createMultipartUpload(key, {
    httpMetadata: {
      contentType,
    },
  });

  const partSize = 8 * 1024 * 1024; // 8MB
  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));

  return Response.json({
    uploadId: mp.uploadId,
    key,
    originalName,
    fileType,
    contentType,
    partSize,
    totalParts,
  });
}
