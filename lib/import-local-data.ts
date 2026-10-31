import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  normalizeLocalSnapshot,
  toJson,
  toPrismaExamId,
} from "@/lib/local-data";

export async function importLocalSnapshotSafe(
  userId: string,
  localSnapshot: unknown,
) {
  const snapshot = normalizeLocalSnapshot(localSnapshot);

  const starredRows = (["itpe", "bigdata", "gov", "network"] as const).flatMap((examId) =>
    snapshot.userState.starredIdsByExam[examId].map((questionId) => ({
      userId,
      examId: toPrismaExamId(examId),
      questionId,
    })),
  );

  if (starredRows.length > 0) {
    await prisma.starredQuestion.createMany({
      data: starredRows,
      skipDuplicates: true,
    });
  }

  const wrongRows = (["itpe", "bigdata", "gov", "network"] as const).flatMap((examId) =>
    snapshot.userState.wrongIdsByExam[examId].map((questionId) => ({
      userId,
      examId: toPrismaExamId(examId),
      questionId,
    })),
  );

  if (wrongRows.length > 0) {
    await prisma.wrongQuestion.createMany({
      data: wrongRows,
      skipDuplicates: true,
    });
  }

  // Use batched, parameterized SQL instead of hundreds of individual Prisma
  // upserts. The old implementation exceeded Vercel's 60s execution limit
  // for users who had worked through the ~950 network questions.
  // Never replace a newer cloud answer with an older device answer.
  for (const examId of ["itpe", "bigdata", "gov", "network"] as const) {
    const entries=Object.entries(snapshot.userState.questionStatsByExam[examId]);
    for (let start=0;start<entries.length;start+=150) {
      const chunk=entries.slice(start,start+150);
      if(!chunk.length)continue;
      const rows=chunk.map(([questionId,stat])=>Prisma.sql`(
        ${randomUUID()}, ${userId}, CAST(${examId} AS "ExamId"), ${questionId},
        ${stat.solvedCount}, ${stat.wrongCount}, ${stat.correctStreak},
        ${stat.lastSolvedAt ? new Date(stat.lastSolvedAt) : null},
        ${stat.nextReviewAt ? new Date(stat.nextReviewAt) : null},
        ${stat.year}, ${stat.round}, ${stat.type}, ${stat.subjectType??null}, NOW()
      )`);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "QuestionStat"
          ("id","userId","examId","questionId","solvedCount","wrongCount",
           "correctStreak","lastSolvedAt","nextReviewAt","year","round",
           "type","subjectType","updatedAt")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("userId","examId","questionId") DO UPDATE SET
          "solvedCount" = EXCLUDED."solvedCount",
          "wrongCount" = EXCLUDED."wrongCount",
          "correctStreak" = EXCLUDED."correctStreak",
          "lastSolvedAt" = EXCLUDED."lastSolvedAt",
          "nextReviewAt" = EXCLUDED."nextReviewAt",
          "year" = EXCLUDED."year",
          "round" = EXCLUDED."round",
          "type" = EXCLUDED."type",
          "subjectType" = EXCLUDED."subjectType",
          "updatedAt" = NOW()
        WHERE "QuestionStat"."lastSolvedAt" IS NULL
           OR EXCLUDED."lastSolvedAt" >= "QuestionStat"."lastSolvedAt"
      `);
    }
  }

  for (const result of snapshot.userState.examResults) {
    const examResult = await prisma.examResult.upsert({
      where: {
        userId_examId_year_round: {
          userId,
          examId: toPrismaExamId(result.examId),
          year: result.year,
          round: result.round,
        },
      },
      create: {
        userId,
        examId: toPrismaExamId(result.examId),
        year: result.year,
        round: result.round,
        updatedAt: new Date(result.updatedAt),
      },
      update: {
        updatedAt: new Date(result.updatedAt),
      },
    });

    for (const attempt of result.attempts) {
      await prisma.examAttempt.upsert({
        where: {
          examResultId_attemptNo: {
            examResultId: examResult.id,
            attemptNo: attempt.attemptNo,
          },
        },
        create: {
          examResultId: examResult.id,
          attemptNo: attempt.attemptNo,
          score: attempt.score,
          total: attempt.total,
          passed: attempt.passed,
          wrongQids: attempt.wrongQids,
          createdAt: new Date(attempt.createdAt),
          subjectScores: attempt.subjectScores
            ? toJson(attempt.subjectScores)
            : undefined,
          perQuestionSnapshot: attempt.perQuestionSnapshot
            ? toJson(attempt.perQuestionSnapshot)
            : undefined,
        },
        update: {
          score: attempt.score,
          total: attempt.total,
          passed: attempt.passed,
          wrongQids: attempt.wrongQids,
          createdAt: new Date(attempt.createdAt),
          subjectScores: attempt.subjectScores
            ? toJson(attempt.subjectScores)
            : undefined,
          perQuestionSnapshot: attempt.perQuestionSnapshot
            ? toJson(attempt.perQuestionSnapshot)
            : undefined,
        },
      });
    }
  }

  if (snapshot.inProgress) {
    await prisma.inProgressSession.upsert({
      where: {
        userId_examId_mode: {
          userId,
          examId: toPrismaExamId(snapshot.inProgress.examId),
          mode: snapshot.inProgress.mode,
        },
      },
      create: {
        userId,
        examId: toPrismaExamId(snapshot.inProgress.examId),
        mode: snapshot.inProgress.mode,
        deckIds: snapshot.inProgress.deckIds,
        index: snapshot.inProgress.index,
        activeExam: snapshot.inProgress.activeExam
          ? toJson(snapshot.inProgress.activeExam)
          : undefined,
        perQuestion: toJson(snapshot.inProgress.perQuestion),
        examSessionWrongQids: snapshot.inProgress.examSessionWrongQids ?? [],
        savedAt: new Date(snapshot.inProgress.savedAt),
      },
      update: {
        deckIds: snapshot.inProgress.deckIds,
        index: snapshot.inProgress.index,
        activeExam: snapshot.inProgress.activeExam
          ? toJson(snapshot.inProgress.activeExam)
          : undefined,
        perQuestion: toJson(snapshot.inProgress.perQuestion),
        examSessionWrongQids: snapshot.inProgress.examSessionWrongQids ?? [],
        savedAt: new Date(snapshot.inProgress.savedAt),
      },
    });
  }

  return snapshot;
}
