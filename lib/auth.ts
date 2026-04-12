import type { PrismaClient, Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRefreshTokenExpiresAt, signAccessToken, signRefreshToken, hashToken, createRefreshTokenId } from "@/lib/tokens";
import { verifyAccessToken } from "@/lib/tokens";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function createAuthSession(
  client: PrismaLike,
  user: Pick<User, "id" | "email">,
  meta?: {
    userAgent?: string | null;
    ipAddress?: string | null;
  },
) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
  });

  const refreshTokenId = createRefreshTokenId();
  const refreshToken = signRefreshToken({
    sub: user.id,
    tokenId: refreshTokenId,
  });

  const expiresAt = getRefreshTokenExpiresAt();

  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      userAgent: meta?.userAgent ?? null,
      ipAddress: meta?.ipAddress ?? null,
    },
  });

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function getUserFromAccessToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) {
    return null;
  }

  try {
    const payload = verifyAccessToken(accessToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return { user, payload };
  } catch {
    return null;
  }
}

export async function requireUser(request: Request) {
  const auth = await getUserFromAccessToken(request);
  if (!auth) {
    throw new Error("UNAUTHORIZED");
  }
  return auth;
}
