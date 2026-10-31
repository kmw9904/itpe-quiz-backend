import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";

type Item=Record<string,unknown>;
function records(value:unknown, max:number):Item[] {
  return (Array.isArray(value)?value:[])
    .filter((v):v is Item=>Boolean(v)&&typeof v==="object"&&!Array.isArray(v))
    .slice(-max);
}
function normalize(value:unknown) {
  const obj=value&&typeof value==="object"&&!Array.isArray(value)?value as Item:{};
  return {
    events:records(obj.events,10000).filter(e=>typeof e.id==="string"&&typeof e.at==="number"),
    unsure:records(obj.unsure,2000).filter(e=>typeof e.questionId==="string"),
    wrongReasons:records(obj.wrongReasons,2000).filter(e=>typeof e.questionId==="string"),
    topicTrainings:records(obj.topicTrainings,200).filter(e=>typeof e.id==="string"),
    studyRuns:records(obj.studyRuns,200).filter(e=>typeof e.id==="string"),
  };
}
function union(a:Item[],b:Item[],key:(x:Item)=>string,at:(x:Item)=>number,max:number) {
  const map=new Map<string,Item>();
  for(const item of [...a,...b]) {
    const k=key(item);
    if(!k) continue;
    const prev=map.get(k);
    if(!prev || at(item)>=at(prev)) map.set(k,item);
  }
  return [...map.values()].sort((x,y)=>at(x)-at(y)).slice(-max);
}
function merge(a:unknown,b:unknown) {
  const left=normalize(a),right=normalize(b);
  const time=(field:string)=>(x:Item)=>typeof x[field]==="number"?x[field] as number:0;
  const keyId=(x:Item)=>typeof x.id==="string"?x.id:"";
  const perQuestion=(x:Item)=>String(x.examId??"")+":"+String(x.questionId??"");
  return {
    events:union(left.events,right.events,keyId,time("at"),10000),
    unsure:union(left.unsure,right.unsure,perQuestion,time("addedAt"),2000),
    wrongReasons:union(left.wrongReasons,right.wrongReasons,perQuestion,time("updatedAt"),2000),
    topicTrainings:union(left.topicTrainings,right.topicTrainings,keyId,time("completedAt"),200),
    studyRuns:union(left.studyRuns,right.studyRuns,keyId,time("completedAt"),200),
  };
}
export async function GET(request:Request) {
  try {
    const {user}=await requireUser(request);
    const row=await prisma.user.findUnique({where:{id:user.id},select:{learningData:true}});
    return Response.json({ok:true,data:normalize(row?.learningData)});
  } catch(error) {
    if(error instanceof Error && error.message==="UNAUTHORIZED")return fail(401,"로그인이 필요합니다.");
    console.error("[GET /api/me/learning]",error);
    return fail(500,"학습 기록 조회에 실패했습니다.");
  }
}
export async function PUT(request:Request) {
  try {
    const {user}=await requireUser(request);
    const body=await request.json();
    if(!body||typeof body!=="object"||!("data" in body))
      return fail(400,"data가 필요합니다.");
    // A newer client must never replace previously uploaded learning events.
    const saved=await prisma.$transaction(async(tx)=>{
      const row=await tx.user.findUnique({where:{id:user.id},select:{learningData:true}});
      const data=merge(row?.learningData,body.data);
      await tx.user.update({where:{id:user.id},data:{learningData:data as unknown as Prisma.InputJsonValue}});
      return data;
    });
    return Response.json({ok:true,data:saved});
  } catch(error) {
    if(error instanceof Error && error.message==="UNAUTHORIZED")return fail(401,"로그인이 필요합니다.");
    console.error("[PUT /api/me/learning]",error);
    return fail(500,"학습 기록 저장에 실패했습니다.");
  }
}
export const maxDuration=30;
