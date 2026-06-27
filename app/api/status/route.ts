import { liveMode } from "@/lib/config";

/** Tiny health/mode probe so the UI can show a live vs demo badge. */
export async function GET() {
  return Response.json({
    mode: liveMode() ? "live" : "mock",
    product: "frontdesk",
  });
}
