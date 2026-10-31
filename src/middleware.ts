import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

function accessIssuer() {
  const team = process.env.CF_ACCESS_TEAM?.trim().replace(/^https?:\/\//, "").replace(/\.cloudflareaccess\.com\/?$/, "");
  return team ? `https://${team}.cloudflareaccess.com` : null;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/acceso-denegado") return NextResponse.next();
  const requestHeaders = new Headers(request.headers);
  const localEmail = process.env.NODE_ENV === "development"
    ? (process.env.DEV_USER_EMAIL || "supervisor@nakama.local").trim().toLowerCase()
    : "";

  if (localEmail) {
    requestHeaders.set("x-nakama-verified-email", localEmail);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const issuer = accessIssuer();
  const audience = process.env.CF_ACCESS_AUD?.trim();
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!issuer || !audience || !token) return accessDenied(request);

  try {
    const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, { issuer, audience });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) return accessDenied(request);
    requestHeaders.set("x-nakama-verified-email", email);
    requestHeaders.delete("cf-access-jwt-assertion");
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return accessDenied(request);
  }
}

function accessDenied(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/acceso-denegado", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|nakama-logo.jpeg).*)"],
};
