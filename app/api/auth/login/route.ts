import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, getClientIp, getUserAgent } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { createAuthSession } from "@/lib/auth";
import { setRefreshCookie } from "@/lib/cookies";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        nickname: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      return fail(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const isMatch = await verifyPassword(body.password, user.passwordHash);
    if (!isMatch) {
      return fail(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const tokens = await createAuthSession(prisma, user, {
      userAgent,
      ipAddress,
    });

    const response = NextResponse.json({
      ok: true,
      message: "로그인되었습니다.",
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.createdAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    setRefreshCookie(response, tokens.refreshToken, tokens.refreshTokenExpiresAt);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(400, "로그인 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/auth/login]", error);
    return fail(500, "로그인 처리 중 오류가 발생했습니다.");
  }
}
