import { upsertRecord } from "../../_lib/storage";

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

  const key = body?.key || "";
  const uploadId = body?.uploadId || "";
  const originalName = body?.originalName || key;
  const contentType = body?.contentType || "application/octet-stream";
  const fileType = body?.fileType || (key.split(".").pop() || "").toLowerCase();
  const size = Number(body?.size || 0);
  const parts = Array.isArray(body?.parts) ? body.parts : [];

  if (!key || !uploadId || parts.length === 0) {
    return Response.json({ error: "Missing key/uploadId/parts" }, { status: 400 });
  }

  const mp = env.FILE_BUCKET.resumeMultipartUpload(key, uploadId);
  const sorted = parts
    .map((p) => ({ partNumber: Number(p.partNumber), etag: p.etag }))
    .filter((p) => p.partNumber > 0 && p.etag)
    .sort((a, b) => a.partNumber - b.partNumber);

  await mp.complete(sorted);

  try {
    await upsertRecord(env, {
      id: key,
      key,
      source: "r2",
      contentType,
      size,
      ext: key.includes(".") ? key.slice(key.lastIndexOf(".")) : "",
      originalName,
      fileType,
      listType: "None",
      label: "None",
      timeStamp: Date.now(),
    });
  } catch (metaErr) {
    console.error("Metadata upsert failed:", metaErr);
  }

  return Response.json([{ src: `/file/${key}` }]);
}
