import { requireBasicAuth } from "./_lib/basic-auth";

export async function onRequest(context) {
  const { request, env, next } = context;
  const authResponse = requireBasicAuth(request, env);
  if (authResponse) return authResponse;
  return next();
}
