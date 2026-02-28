function unauthorized(message = "Unauthorized") {
  return new Response(message, {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

function badRequest(message = "Bad Request") {
  return new Response(message, {
    status: 400,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function parseBasicAuthHeader(value) {
  if (!value) return null;
  const [scheme, encoded] = value.split(" ");
  if (scheme !== "Basic" || !encoded) {
    throw badRequest("Malformed authorization header.");
  }

  const bytes = Uint8Array.from(atob(encoded), (ch) => ch.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes).normalize();
  const idx = decoded.indexOf(":");
  if (idx === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw badRequest("Invalid authorization value.");
  }

  return {
    user: decoded.slice(0, idx),
    pass: decoded.slice(idx + 1),
  };
}

export function requireBasicAuth(request, env) {
  if (!env.BASIC_USER || !env.BASIC_PASS) {
    return new Response(
      "Admin auth is not configured. Please set BASIC_USER and BASIC_PASS.",
      { status: 500 }
    );
  }

  try {
    const auth = parseBasicAuthHeader(request.headers.get("Authorization"));
    if (!auth) return unauthorized("You need to login.");
    if (auth.user !== env.BASIC_USER || auth.pass !== env.BASIC_PASS) {
      return unauthorized("Invalid credentials.");
    }
    return null;
  } catch (err) {
    if (err instanceof Response) return err;
    return badRequest("Invalid authorization header.");
  }
}
