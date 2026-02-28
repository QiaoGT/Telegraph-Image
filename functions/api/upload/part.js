export async function onRequestPut(context) {
  const { request, env } = context;
  if (!env.FILE_BUCKET) {
    return Response.json(
      { error: "R2 bucket binding FILE_BUCKET is required." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const uploadId = url.searchParams.get("uploadId") || "";
  const partNumber = Number(url.searchParams.get("partNumber") || 0);

  if (!key || !uploadId || !partNumber) {
    return Response.json(
      { error: "Missing key/uploadId/partNumber" },
      { status: 400 }
    );
  }

  const chunk = await request.arrayBuffer();
  const mp = env.FILE_BUCKET.resumeMultipartUpload(key, uploadId);
  const uploaded = await mp.uploadPart(partNumber, chunk);

  return Response.json({
    partNumber,
    etag: uploaded.etag,
  });
}
