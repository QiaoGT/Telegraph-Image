import { setListType } from "../../../_lib/storage";

export async function onRequest(context) {
  const { env, params } = context;
  const id = decodeURIComponent(params.id || "");
  if (!id) return new Response("Missing id", { status: 400 });

  const rec = await setListType(env, id, "Block");
  return Response.json({
    TimeStamp: rec.timeStamp,
    ListType: rec.listType,
    Label: rec.label,
  });
}
