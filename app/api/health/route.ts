import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "itpe-quiz-auth-backend",
    now: new Date().toISOString(),
  });
}
