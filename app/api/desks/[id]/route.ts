import {
  getDeskView,
  updateDeskProfile,
  revokeDesk,
  ValidationError,
  type CreateDeskPayload,
} from "@/lib/desk-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/desks/:id — single desk view. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const desk = await getDeskView(id);
  if (!desk) return Response.json({ error: "Desk not found" }, { status: 404 });
  return Response.json({ desk });
}

/** PATCH /api/desks/:id — update profile / scope config. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: CreateDeskPayload;
  try {
    body = (await request.json()) as CreateDeskPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const desk = await updateDeskProfile(id, body);
    if (!desk)
      return Response.json({ error: "Desk not found" }, { status: 404 });
    return Response.json({ desk });
  } catch (err) {
    if (err instanceof ValidationError)
      return Response.json({ error: err.message }, { status: 400 });
    console.error("[api/desks/:id] update failed:", err);
    return Response.json({ error: "Could not update desk" }, { status: 500 });
  }
}

/** DELETE /api/desks/:id — revoke the desk + its Aicoo share link. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await revokeDesk(id);
  if (!ok) return Response.json({ error: "Desk not found" }, { status: 404 });
  return Response.json({ ok: true });
}
