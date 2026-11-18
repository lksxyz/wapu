import http from "node:http";
import { auth } from "./auth.js";
import { handleApi } from "./routes/api.js";
import { handlePreviewHost, handlePublicHost } from "./preview/host.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = [process.env.PLATFORM_URL ?? "http://localhost:5173", "http://localhost:4173"];
  const allowOrigin = origin && allowed.some((o) => origin.startsWith(o)) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
  };
}

async function nodeToWebRequest(req: http.IncomingMessage): Promise<Request> {
  return new Promise<Request>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = `http://localhost${req.url ?? "/"}`;
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val) {
          if (Array.isArray(val)) val.forEach((v) => headers.append(key, v));
          else headers.set(key, val);
        }
      }
      resolve(
        new Request(url, {
          method: req.method ?? "GET",
          headers,
          // GET/HEAD must not have a body
          body: body.length > 0 && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
          // Needed so Node's fetch doesn't decompress twice
          duplex: "half" as unknown as undefined,
        }),
      );
    });
  });
}

async function webResponseToNode(webRes: Response, res: http.ServerResponse): Promise<void> {
  // Flatten multi-value Set-Cookie into separate headers
  const rawHeaders: string[] = [];
  webRes.headers.forEach((val, key) => {
    rawHeaders.push(key, val);
  });
  res.writeHead(webRes.status, rawHeaders);
  if (webRes.body) {
    const reader = webRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const origin = req.headers["origin"] as string | undefined;
    const cors = corsHeaders(origin);
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

    // Preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = (req.headers["host"] ?? "").split(":")[0];
    const url = req.url ?? "/";
    const previewDomain = process.env.PREVIEW_DOMAIN ?? "preview.localhost";
    const publicDomain = process.env.PUBLIC_DOMAIN ?? "localhost";

    // ── Draft preview: {projectId}.preview.localhost ──────────────────────
    if (host.endsWith(`.${previewDomain}`)) {
      const projectId = host.slice(0, -(previewDomain.length + 1));
      try {
        await handlePreviewHost(req, res, projectId, url);
      } catch (e) {
        console.error("[preview] handler error:", e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Preview error");
        } else {
          res.destroy();
        }
      }
      return;
    }

    // ── Deployed snapshot: {slug}.localhost ───────────────────────────────
    if (host !== publicDomain && host.endsWith(`.${publicDomain}`)) {
      const slug = host.slice(0, -(publicDomain.length + 1));
      try {
        await handlePublicHost(req, res, slug, url);
      } catch (e) {
        console.error("[public] handler error:", e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Preview error");
        } else {
          res.destroy();
        }
      }
      return;
    }

    // ── better-auth: /auth/** ─────────────────────────────────────────────
    if (url.startsWith("/auth/")) {
      try {
        const webReq = await nodeToWebRequest(req);
        const webRes = await auth.handler(webReq);
        await webResponseToNode(webRes, res);
      } catch (e) {
        console.error("[auth] handler error:", e);
        res.writeHead(500);
        res.end("Internal Server Error");
      }
      return;
    }

    // ── Everything else ───────────────────────────────────────────────────
    try {
      await handleApi(req, res);
    } catch (e) {
      console.error("[api] handler error:", e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      } else {
        res.destroy();
      }
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[wapu-api] Listening on http://${HOST}:${PORT}`);
  });

  return server;
}
