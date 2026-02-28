import { deleteRecord } from "../../../_lib/storage";

export async function onRequest(context) {
  const { env, params } = context;
  const id = decodeURIComponent(params.id || "");
  if (!id) return new Response("Missing id", { status: 400 });

  const key = await deleteRecord(env, id);
  if (env.FILE_BUCKET) {
    await env.FILE_BUCKET.delete(key || id);
  }

  return Response.json({ id, deleted: true });
}
