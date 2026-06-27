import { deskInbox, getDeskView } from "@/lib/desk-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/desks/:id/conversations — the desk's inbox for the dashboard. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const desk = await getDeskView(id);
  if (!desk) return Response.json({ error: "Desk not found" }, { status: 404 });
  const conversations = await deskInbox(id);
  return Response.json({ conversations });
}
