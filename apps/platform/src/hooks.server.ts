import { redirect } from "@sveltejs/kit";

const API_URL = process.env.VITE_API_URL ?? "http://localhost:3000";
const PUBLIC_PREFIXES = ["/login"];

// N: session required for all routes except PUBLIC_PREFIXES.
// A: getSession → session? → resolve : redirect /login
// E: fetch failure → treat as no session (Escape, not Die — dev server may be down)
export async function handle({
  event,
  resolve,
}: {
  event: import("@sveltejs/kit").RequestEvent;
  resolve: (event: import("@sveltejs/kit").RequestEvent) => Promise<Response>;
}): Promise<Response> {
  const cookie = event.request.headers.get("cookie") ?? "";

  try {
    const res = await fetch(`${API_URL}/auth/get-session`, {
      headers: { cookie },
    });
    const data = (await res.json().catch(() => null)) as {
      user?: { id: string; name: string; email: string; image?: string };
    } | null;
    event.locals.session = data?.user ? { user: data.user } : null;
  } catch {
    event.locals.session = null;
  }

  const isPublic = PUBLIC_PREFIXES.some((p) => event.url.pathname.startsWith(p));

  if (!event.locals.session && !isPublic) {
    redirect(302, "/login");
  }

  return resolve(event);
}
