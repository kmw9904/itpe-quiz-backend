import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL이 필요합니다."),
  DIRECT_URL: z.string().min(1, "DIRECT_URL이 필요합니다."),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET은 최소 32자 이상이어야 합니다."),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET은 최소 32자 이상이어야 합니다."),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_DOMAIN: z.string().optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_TTL_MINUTES: process.env.ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS: process.env.REFRESH_TOKEN_TTL_DAYS,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
});
