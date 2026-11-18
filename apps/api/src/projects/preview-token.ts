import crypto from "node:crypto";

// The preview URL is handed to an iframe and to copied links, so it must
// outlive a working session. One hour was short enough that a tab left open
// over lunch came back to a 401.
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const COOKIE_NAME = "wapu_preview";

export interface PreviewClaims {
  projectId: string;
  userId: string;
  exp: number;
}

function secret(): string {
  return process.env.PREVIEW_TOKEN_SECRET ?? "dev-preview-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signPreviewToken(
  projectId: string,
  userId: string,
  ttlSeconds = TOKEN_TTL_SECONDS,
): string {
  const claims: PreviewClaims = {
    projectId,
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf-8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyPreviewToken(token: string): PreviewClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as PreviewClaims;
    if (!claims.projectId || !claims.userId || claims.exp < Date.now() / 1000) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export const PREVIEW_COOKIE = COOKIE_NAME;

export function previewCookie(token: string, secure: boolean): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL_SECONDS}${
    secure ? "; Secure" : ""
  }`;
}

function origin(host: string, domain: string): string {
  const scheme = process.env.PUBLIC_SCHEME ?? "http";
  const explicitPort = process.env.PUBLIC_PORT;
  const port = explicitPort
    ? `:${explicitPort}`
    : domain.endsWith("localhost")
      ? `:${process.env.PORT ?? 3000}`
      : "";
  return `${scheme}://${host}.${domain}${port}`;
}

export function previewUrl(projectId: string, userId: string): string {
  const token = signPreviewToken(projectId, userId);
  const domain = process.env.PREVIEW_DOMAIN ?? "preview.localhost";
  return `${origin(projectId, domain)}/?token=${encodeURIComponent(token)}`;
}

export function deployUrl(slug: string): string {
  const domain = process.env.PUBLIC_DOMAIN ?? "localhost";
  return origin(slug, domain);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}
