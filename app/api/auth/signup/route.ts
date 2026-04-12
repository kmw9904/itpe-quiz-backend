import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fail, getClientIp, getUserAgent } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { createAuthSession } from "@/lib/auth";
import { setRefreshCookie } from "@/lib/cookies";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다."),
  nickname: z.string().trim().min(1).max(40).optional(),
  deviceId: z.string().trim().min(1).max(200).optional(),
  importVersion: z.number().int().positive().optional(),
  localSnapshot: z.unknown().optional(),
});

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (existing) {
      return fail(409, "이미 가입된 이메일입니다.");
    }

    const passwordHash = await hashPassword(body.password);
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          nickname: body.nickname ?? null,
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          createdAt: true,
        },
      });

      const tokens = await createAuthSession(tx, user, {
        userAgent,
        ipAddress,
      });

      return { user, tokens };
    });

    const response = NextResponse.json({
      ok: true,
      message: "회원가입이 완료되었습니다.",
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });

    setRefreshCookie(
      response,
      result.tokens.refreshToken,
      result.tokens.refreshTokenExpiresAt,
    );

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(400, "회원가입 요청 형식이 올바르지 않습니다.", {
        issues: error.issues,
      });
    }

    console.error("[POST /api/auth/signup]", error);
    return fail(500, "회원가입 처리 중 오류가 발생했습니다.");
  }
}
