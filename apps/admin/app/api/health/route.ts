import { NextResponse } from "next/server";
import { getDatabase } from "@growth-os/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id")?.trim().slice(0, 128) || crypto.randomUUID();
  const { client } = getDatabase();
  try {
    await client`SELECT 1 AS ready`;
    return NextResponse.json(
      { status: "ready", service: "growthos-admin" },
      { status: 200, headers: { "cache-control": "no-store", "x-request-id": requestId } }
    );
  } catch (error) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), service: "growthos-admin", level: "error", event: "readiness_failed", correlationId: requestId, error: error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR" }));
    return NextResponse.json(
      { status: "unavailable", service: "growthos-admin" },
      { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } }
    );
  } finally {
    await client.end();
  }
}
