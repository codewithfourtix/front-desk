import {
  createDesk,
  listDeskViews,
  ValidationError,
  type CreateDeskPayload,
} from "@/lib/desk-service";

/** GET /api/desks — all desks for the host dashboard, with analytics. */
export async function GET() {
  const desks = await listDeskViews();
  return Response.json({ desks });
}

/** POST /api/desks — create a desk (mints an Aicoo share link under the hood). */
export async function POST(request: Request) {
  let body: CreateDeskPayload;
  try {
    body = (await request.json()) as CreateDeskPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const desk = await createDesk(body);
    return Response.json({ desk }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/desks] create failed:", err);
    return Response.json({ error: "Could not create desk" }, { status: 500 });
  }
}
