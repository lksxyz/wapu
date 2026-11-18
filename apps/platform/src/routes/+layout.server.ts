import type { LayoutServerLoad } from "./$types";
import type { Project } from "#lib/api";

// N: sidebar needs user + project list on every authed route.
export const load: LayoutServerLoad = async ({ locals, request, fetch }) => {
  const user = locals.session?.user ?? null;
  if (!user) return { user: null, projects: [] as Project[] };

  const api = process.env.VITE_API_URL ?? "http://localhost:3000";
  const res = await fetch(`${api}/api/projects`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });

  const projects = res.ok ? ((await res.json()) as Project[]) : [];

  return { user, projects };
};
