import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import type { ProjectDetail } from "#lib/api";

export const load: PageServerLoad = async ({ params, request, fetch }) => {
  const cookie = request.headers.get("cookie") ?? "";
  const api = process.env.VITE_API_URL ?? "http://localhost:3000";

  const res = await fetch(`${api}/api/projects/${params.id}`, {
    headers: { cookie },
  });

  if (res.status === 401) redirect(302, "/login");
  if (res.status === 404) error(404, "Project not found");
  if (!res.ok) error(res.status, "Failed to load project");

  const project = (await res.json()) as ProjectDetail;

  return { project };
};
