import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "@/lib/env";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  tokenId: string;
  type: "refresh";
};

export function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">) {
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      type: "access",
    } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    },
  );
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">) {
  return jwt.sign(
    {
      sub: payload.sub,
      tokenId: payload.tokenId,
      type: "refresh",
    } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
    },
  );
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== "access") {
    throw new Error("잘못된 access token 입니다.");
  }
  return decoded;
}

export function verifyRefreshToken(token: string) {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("잘못된 refresh token 입니다.");
  }
  return decoded;
}

export function createRefreshTokenId() {
  return crypto.randomUUID();
}

export function getRefreshTokenExpiresAt() {
  const next = new Date();
  next.setDate(next.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return next;
}
