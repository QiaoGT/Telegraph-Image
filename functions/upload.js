import {
  createObjectKey,
  guessMimeTypeFromName,
  upsertRecord,
} from "./_lib/storage";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.FILE_BUCKET) {
    return Response.json(
      {
        error: "R2 bucket binding FILE_BUCKET is required.",
        hint: "Please bind FILE_BUCKET in the same Pages environment (Production/Preview) you are visiting.",
      },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const input = formData.get("file") || formData.get("Files");
    if (!input || typeof input.arrayBuffer !== "function") {
      return new Response("No file uploaded.", { status: 400 });
    }

    const originalName = input.name || `file-${crypto.randomUUID()}`;
    const id = await createObjectKey(env, originalName);
    const objectBody = await input.arrayBuffer();
    const contentType =
      input.type || guessMimeTypeFromName(originalName) || "application/octet-stream";
    const fileType = (originalName.split(".").pop() || "").toLowerCase();

    await env.FILE_BUCKET.put(id, objectBody, {
      httpMetadata: {
        contentType,
      },
    });

    // Metadata write should not break successful object upload.
    try {
      await upsertRecord(env, {
        id,
        key: id,
        source: "r2",
        contentType,
        size: input.size || 0,
        ext: id.includes(".") ? id.slice(id.lastIndexOf(".")) : "",
        originalName,
        fileType,
        listType: "None",
        label: "None",
        timeStamp: Date.now(),
      });
    } catch (metaErr) {
      console.error("Metadata upsert failed:", metaErr);
    }

    const payload = [{ src: `/file/${id}` }];
    return Response.json(payload);
  } catch (err) {
    console.error("Upload failed:", err);
    return Response.json(
      { error: "Upload failed", detail: String(err && err.message ? err.message : err) },
      { status: 500 }
    );
  }
}
  
