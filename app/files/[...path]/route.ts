import { requireUser } from "@/lib/require-user";
import { readUpload } from "@/lib/uploads";

// Serves the logo (and any other stored file) from local uploads/ or private Blob storage.
export async function GET(_req: Request, ctx: RouteContext<"/files/[...path]">) {
  await requireUser();
  const { path } = await ctx.params;
  const file = await readUpload(path.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=0" },
  });
}
