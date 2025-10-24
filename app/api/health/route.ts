import { NextResponse } from "next/server";

/**
 * Health check endpoint for GCP App Engine
 * Used by liveness_check and readiness_check in app.yaml
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "msg2agentbuilder",
    },
    { status: 200 }
  );
}
