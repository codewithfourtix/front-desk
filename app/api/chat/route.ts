import { deskChatStream, turnBooks, type DeskTurn } from "@/lib/aicoo";
import { deskIsOpen } from "@/lib/desk-service";
import {
  getDeskByToken,
  getConversation,
  startConversation,
  appendMessage,
  shortToken,
} from "@/lib/store";

interface ChatBody {
  token?: string;
  message?: string;
  conversationId?: string;
  timezone?: string;
}

/**
 * POST /api/chat — a visitor turn at a public desk.
 *
 * Streams the agent's reply back as newline-delimited JSON FrontdeskChunks.
 * The first line is always a `meta` chunk carrying the conversationId so the
 * client can continue the thread. Visitor + agent turns are logged to the store
 * so the host's dashboard inbox updates in real time.
 */
export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  if (!message)
    return Response.json({ error: "Message cannot be empty" }, { status: 400 });
  if (message.length > 2000)
    return Response.json({ error: "Message too long" }, { status: 400 });

  const desk = await getDeskByToken(token);
  if (!desk) return Response.json({ error: "Desk not found" }, { status: 404 });
  if (!deskIsOpen(desk))
    return Response.json(
      { error: "This desk is closed or the link has expired." },
      { status: 410 }
    );

  // Resolve (or open) the conversation, and snapshot history BEFORE this turn.
  let conversation = body.conversationId
    ? await getConversation(body.conversationId)
    : undefined;
  if (!conversation || conversation.deskId !== desk.id) {
    conversation = await startConversation(
      desk.id,
      `Visitor · ${shortToken(4)}`
    );
  }
  const history = conversation.messages.map((m) => ({
    role: m.role,
    text: m.text,
  }));

  await appendMessage(conversation.id, { role: "visitor", text: message });

  const turn: DeskTurn = {
    profile: desk.profile,
    message,
    history,
    timezone: body.timezone,
  };
  // Mock mode can tell us up-front whether this turn books; live mode infers
  // from the tool chunks it emits.
  const meta = turnBooks(turn);

  const encoder = new TextEncoder();
  const convId = conversation.id;

  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      // Enqueue defensively: if the client has disconnected (controller closed),
      // never throw — just stop streaming. This is what made the route crash
      // with "Controller is already closed" when a request was interrupted.
      const send = (obj: unknown): boolean => {
        if (closed || cancelled) return false;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      send({ kind: "meta", conversationId: convId });

      let fullText = "";
      const toolsUsed = new Set<string>(meta.tools);

      try {
        for await (const chunk of deskChatStream(turn)) {
          if (cancelled || closed) break;
          if (chunk.kind === "text") fullText += chunk.text;
          if (chunk.kind === "tool") toolsUsed.add(chunk.tool);
          send(chunk);
        }
      } catch (err) {
        console.error("[api/chat] stream error:", err);
        send({ kind: "error", message: "The desk hit a snag. Try again." });
      }

      // Persist whatever the agent produced, even on a partial/interrupted turn,
      // so the host's inbox still reflects it. A booking is confirmed either by
      // the mock meta or by the live agent firing calendar-write tools.
      const booked =
        meta.booking ||
        [...toolsUsed].some((t) =>
          ["schedule_meeting", "create_calendar_event"].includes(t)
        );
      if (fullText.trim()) {
        await appendMessage(convId, {
          role: "agent",
          text: fullText.trim(),
          tools: [...toolsUsed],
          booking: booked,
        });
      }

      if (!closed) {
        try {
          controller.close();
        } catch {
          /* already closed by the client — fine */
        }
      }
    },
    cancel() {
      // Client went away (navigated, refreshed, or dev HMR recompiled). Stop.
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
