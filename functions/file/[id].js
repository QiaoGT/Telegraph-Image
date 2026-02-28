import { getRecord, guessMimeTypeFromName, upsertRecord } from "../_lib/storage";

function isBlocked(record) {
  if (!record) return false;
  return record.listType === "Block" || record.label === "adult";
}

function isAdminReferer(request, origin) {
  const referer = request.headers.get("Referer") || "";
  return referer === `${origin}/admin` || referer === `${origin}/admin.html`;
}

function blockRedirect(url, request) {
  const referer = request.headers.get("Referer");
  if (!referer) {
    return Response.redirect(`${url.origin}/block-img.html`, 302);
  }
  return Response.redirect(
    "https://static-res.pages.dev/teleimage/img-block-compressed.png",
    302
  );
}

function setObjectHeaders(headers, object) {
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  const ct = object.httpMetadata?.contentType;
  if (ct) headers.set("Content-Type", ct);
  if (typeof object.size === "number") {
    headers.set("Content-Length", String(object.size));
  }
  const etag = object.httpEtag || object.etag;
  if (etag) headers.set("ETag", etag);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const id = decodeURIComponent(params.id || "");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const record = await getRecord(env, id);
  if (!isAdminReferer(request, url.origin)) {
    if (isBlocked(record)) {
      return blockRedirect(url, request);
    }
    if (env.WhiteList_Mode === "true" && record?.listType !== "White") {
      return Response.redirect(`${url.origin}/whitelist-on.html`, 302);
    }
  }

  if (env.FILE_BUCKET) {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const object = await env.FILE_BUCKET.get(id);
    if (object) {
      if (!record) {
        const fallbackType =
          object.httpMetadata?.contentType ||
          guessMimeTypeFromName(id) ||
          "application/octet-stream";
        await upsertRecord(env, {
          id,
          key: id,
          source: "r2",
          contentType: fallbackType,
          size: object.size || 0,
          ext: id.includes(".") ? id.slice(id.lastIndexOf(".")) : "",
          originalName: id,
          fileType: (id.split(".").pop() || "").toLowerCase(),
          listType: "None",
          label: "None",
          timeStamp: Date.now(),
        });
      }

      const headers = new Headers();
      setObjectHeaders(headers, object);
      if (!headers.get("Content-Type")) {
        headers.set(
          "Content-Type",
          guessMimeTypeFromName(id) || "application/octet-stream"
        );
      }
      if (method === "HEAD") {
        return new Response(null, { headers });
      }
      return new Response(object.body, { headers });
    }
  }

  // Backward compatibility: existing Telegraph paths can still be accessed.
  return fetch(`https://telegra.ph/file/${id}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}
  
