import { listRecords } from "../../_lib/storage";

export async function onRequest(context) {
  const { env } = context;
  const rows = await listRecords(env);
  return Response.json(rows);
}
