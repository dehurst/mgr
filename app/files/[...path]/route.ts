import fs from "node:fs/promises";
import { mimeForPath, resolveUpload } from "@/lib/uploads";

// Serves receipts and the logo from the uploads folder (which lives outside public/).
export async function GET(_req: Request, ctx: RouteContext<"/files/[...path]">) {
  const { path } = await ctx.params;
  const abs = resolveUpload(path.join("/"));
  if (!abs) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(abs);
    return new Response(data, {
      headers: { "Content-Type": mimeForPath(abs), "Cache-Control": "private, max-age=0" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
