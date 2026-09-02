import { NextResponse } from "next/server";
import { getDatabase } from "@growth-os/db";
import { correlationId, reportError } from "../../../lib/operability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = correlationId(request);
  const { client } = getDatabase();
  try {
    await client`SELECT 1 AS ready`;
    return NextResponse.json(
      { status: "ready", service: "growthos-web" },
      { status: 200, headers: { "cache-control": "no-store", "x-request-id": requestId } }
    );
  } catch (error) {
    await reportError("readiness_failed", error, { correlationId: requestId });
    return NextResponse.json(
      { status: "unavailable", service: "growthos-web" },
      { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } }
    );
  } finally {
    await client.end();
  }
}
