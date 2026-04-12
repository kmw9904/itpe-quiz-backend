import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, getClientIp, getUserAgent } from "@/lib/http";
import { clearRefreshCookie, getRefreshCookieName, setRefreshCookie } from "@/lib/cookies";
import { createAuthSession } from "@/lib/auth";
import { hashToken, verifyRefreshToken } from "@/lib/tokens";

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const body = refreshSchema.parse(await request.json().catch(() => ({})));
    const cookieRefreshToken =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${getRefreshCookieName()}=`))
        ?.slice(`${getRefreshCookieName()}=`.length) ?? null;

    const refreshToken = body.refreshToken ?? cookieRefreshToken;
    if (!refreshToken) {
      return fail(401, "refresh token 이 필요합니다.");
    }

    const payload = verifyRefreshToken(refreshToken);
    const refreshTokenHash = hashToken(refreshToken);

    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash: refreshTokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            createdAt: true,
          },
        },
      },
    });

    if (!existing || existing.userId !== payload.sub) {
      return fail(401, "유효하지 않은 refresh token 입니다.");
    }

    if (existing.revokedAt) {
      return fail(401, "이미 만료된 refresh token 입니다.");
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      return fail(401, "만료된 refresh token 입니다.");
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    const rotated = await prisma.$transaction(async (tx) => {
      const tokens = await createAuthSession(tx, existing.user, {
        userAgent,
        ipAddress,
      });

      const newHash = hashToken(tokens.refreshToken);
      const newTokenRecord = await tx.refreshToken.findUniqueOrThrow({
        where: { tokenHash: newHash },
        select: { id: true },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: newTokenRecord.id,
        },
      });

      return tokens;
    });

    const response = NextResponse.json({
      ok: true,
      message: "자동로그인 토큰이 갱신되었습니다.",
      user: existing.user,
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    });

    setRefreshCookie(response, rotated.refreshToken, rotated.refreshTokenExpiresAt);
    return response;
  } catch (error) {
    console.error("[POST /api/auth/refresh]", error);

    const response = fail(401, "refresh token 갱신에 실패했습니다.");
    clearRefreshCookie(response);
    return response;
  }
}
