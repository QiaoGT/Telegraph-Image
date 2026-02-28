import { requireBasicAuth } from "./_lib/basic-auth";

export async function onRequest(context) {
  const { request, env } = context;
  const authResponse = requireBasicAuth(request, env);
  if (authResponse) return authResponse;

  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/admin.html`, 302);
}
