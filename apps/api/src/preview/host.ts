import type { IncomingMessage, ServerResponse } from "node:http";
import { Effect } from "effect";
import { getProject, getProjectBySlug } from "../projects/storage.js";
import { realProjectDir, snapshotDir } from "../projects/workspace.js";
import {
  PREVIEW_COOKIE,
  parseCookies,
  previewCookie,
  verifyPreviewToken,
} from "../projects/preview-token.js";
import { serveStatic } from "./serve.js";

function html(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end(`<!DOCTYPE html><html><body><h1>${status} — ${message}</h1></body></html>`);
}

// The previewed document loads with its token in the query. A subresource the
// page requests (a second file, a stylesheet) is same-origin, so it carries
// that URL as the referrer and the token with it. This is what keeps multi-file
// projects working where the iframe withholds cookies.
function refererToken(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).searchParams.get("token");
  } catch {
    return null;
  }
}

export async function handlePreviewHost(
  req: IncomingMessage,
  res: ServerResponse,
  projectId: string,
  url: string,
): Promise<void> {
  const project = await Effect.runPromise(
    getProject(projectId).pipe(Effect.catch(() => Effect.succeed(null))),
  );
  if (!project) {
    html(res, 404, "Not Found");
    return;
  }

  const parsed = new URL(url, "http://preview.local");
  const cookieToken = parseCookies(req.headers.cookie)[PREVIEW_COOKIE];
  const token =
    parsed.searchParams.get("token") ?? cookieToken ?? refererToken(req.headers.referer);
  const claims = token ? verifyPreviewToken(token) : null;

  if (!claims || claims.projectId !== project.id || claims.userId !== project.userId) {
    html(res, 401, token ? "Preview link expired" : "Preview token required");
    return;
  }

  // A preview iframe is a third-party context, so the browser withholds this
  // cookie there and the redirect would land on a tokenless request. Serve the
  // document with the token still in hand; the cookie stays as a convenience
  // for reloads that happen to have it.
  if (parsed.searchParams.has("token")) {
    const secure = (process.env.PUBLIC_SCHEME ?? "http") === "https";
    res.setHeader("Set-Cookie", previewCookie(token, secure));
  }

  let root: string;
  try {
    root = await realProjectDir(project.id);
  } catch {
    html(res, 404, "Not Found");
    return;
  }

  await serveStatic(res, root, parsed.pathname, "no-store");
}

export async function handlePublicHost(
  _req: IncomingMessage,
  res: ServerResponse,
  slug: string,
  url: string,
): Promise<void> {
  const project = await Effect.runPromise(
    getProjectBySlug(slug).pipe(Effect.catch(() => Effect.succeed(null))),
  );
  if (!project || !project.isDeployed || project.deployVersion < 1) {
    html(res, 404, "Not Found");
    return;
  }

  const parsed = new URL(url, "http://public.local");
  await serveStatic(
    res,
    snapshotDir(project.id, project.deployVersion),
    parsed.pathname,
    "public, max-age=0, must-revalidate",
  );
}
