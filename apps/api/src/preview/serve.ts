import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function notFound(res: ServerResponse): void {
  res.writeHead(404, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end("<!DOCTYPE html><html><body><h1>404 — Not Found</h1></body></html>");
}

export async function serveStatic(
  res: ServerResponse,
  root: string,
  pathname: string,
  cache: string,
): Promise<void> {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    notFound(res);
    return;
  }

  if (relative.includes("\0") || relative.split("/").includes("..")) {
    notFound(res);
    return;
  }
  if (!relative || relative.endsWith("/")) relative += "index.html";

  const realRoot = await fsp.realpath(root).catch(() => null);
  if (!realRoot) {
    notFound(res);
    return;
  }

  const target = path.resolve(realRoot, relative);
  if (!target.startsWith(realRoot + path.sep)) {
    notFound(res);
    return;
  }

  const stat = await fsp.stat(target).catch(() => null);
  if (!stat || !stat.isFile()) {
    notFound(res);
    return;
  }

  const realTarget = await fsp.realpath(target).catch(() => null);
  if (!realTarget || !realTarget.startsWith(realRoot + path.sep)) {
    notFound(res);
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[path.extname(realTarget).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });

  const stream = fs.createReadStream(realTarget);
  stream.on("error", () => {
    if (!res.headersSent) notFound(res);
    else res.destroy();
  });
  stream.pipe(res);
}
