import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const REFRESH_COOKIE_NAME = "itpe_quiz_refresh_token";

export function getRefreshCookieName() {
  return REFRESH_COOKIE_NAME;
}

export function setRefreshCookie(response: NextResponse, refreshToken: string, expiresAt: Date) {
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: refreshToken,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

export function clearRefreshCookie(response: NextResponse) {
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    domain: env.COOKIE_DOMAIN || undefined,
  });
}
