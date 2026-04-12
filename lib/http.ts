import { NextResponse } from "next/server";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...((data ?? {}) as object) }, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      message,
      ...(extra ?? {}),
    },
    { status },
  );
}

export function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export function getUserAgent(request: Request) {
  return request.headers.get("user-agent");
}
