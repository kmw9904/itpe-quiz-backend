import { z } from "zod";
import { NextResponse } from "next/server";
import { clearRefreshCookie, getRefreshCookieName } from "@/lib/cookies";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/http";
import { hashToken } from "@/lib/tokens";

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = logoutSchema.parse(await request.json().catch(() => ({})));
    const cookieRefreshToken =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${getRefreshCookieName()}=`))
        ?.slice(`${getRefreshCookieName()}=`.length) ?? null;

    const refreshToken = body.refreshToken ?? cookieRefreshToken;

    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: {
          tokenHash: hashToken(refreshToken),
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const response = NextResponse.json({
      ok: true,
      message: "로그아웃되었습니다.",
    });

    clearRefreshCookie(response);
    return response;
  } catch (error) {
    console.error("[POST /api/auth/logout]", error);
    return fail(500, "로그아웃 처리 중 오류가 발생했습니다.");
  }
}
