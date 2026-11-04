import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { z } from "zod";

// Self-reported records only. Public qualification catalog APIs cannot prove ownership.
const itemSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["national-technical","national-professional","accredited-private","other"]),
  issuer: z.string().trim().max(100).default(""),
  status: z.enum(["acquired","preparing"]),
  acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  updatedAt: z.number().int().positive(),
  deleted: z.boolean().default(false),
}).strict();

type Item = z.infer<typeof itemSchema>;
function parseItems(value: unknown): Item[] {
  if(!Array.isArray(value))return [];
  return value.slice(0,200).flatMap(raw=>{
    const result=itemSchema.safeParse(raw);
    if(!result.success)return [];
    const item=result.data;
    if(item.acquiredOn){
      const [year,month,day]=item.acquiredOn.split("-").map(Number);
      const date=new Date(Date.UTC(year,month-1,day));
      if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)
        return [];
    }
    return [item];
  });
}
function merge(server: Item[], incoming: Item[]) {
  const byId=new Map<string,Item>();
  for(const item of [...server,...incoming]){
    const last=byId.get(item.id);
    if(!last||item.updatedAt>last.updatedAt||(item.updatedAt===last.updatedAt&&item.deleted))
      byId.set(item.id,item);
  }
  return [...byId.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,200);
}
function unauthorized(error:unknown) {
  return error instanceof Error && error.message==="UNAUTHORIZED";
}
export async function GET(request:Request) {
  try {
    const {user}=await requireUser(request);
    const found=await prisma.user.findUnique({where:{id:user.id},select:{certificationData:true}});
    return Response.json({ok:true,items:parseItems(found?.certificationData)});
  } catch(error) {
    if(unauthorized(error))return fail(401,"로그인이 필요합니다.");
    console.error("[GET /api/me/certifications]",error);
    return fail(500,"자격증 목록을 불러올 수 없습니다.");
  }
}
export async function PUT(request:Request) {
  try {
    const {user}=await requireUser(request);
    const body=z.object({items:z.array(z.unknown()).max(200)}).parse(await request.json());
    if(body.items.some(item=>!itemSchema.safeParse(item).success))
      return fail(400,"자격증 입력값이 올바르지 않습니다.");
    const incoming=parseItems(body.items);
    const merged=await prisma.$transaction(async tx=>{
      const found=await tx.user.findUnique({where:{id:user.id},select:{certificationData:true}});
      const items=merge(parseItems(found?.certificationData),incoming);
      await tx.user.update({where:{id:user.id},data:{certificationData:items as unknown as Prisma.InputJsonValue}});
      return items;
    });
    return Response.json({ok:true,items:merged});
  } catch(error) {
    if(unauthorized(error))return fail(401,"로그인이 필요합니다.");
    if(error instanceof z.ZodError)return fail(400,"자격증 입력값이 올바르지 않습니다.");
    console.error("[PUT /api/me/certifications]",error);
    return fail(500,"자격증 목록을 저장하지 못했습니다.");
  }
}
export const maxDuration=30;
