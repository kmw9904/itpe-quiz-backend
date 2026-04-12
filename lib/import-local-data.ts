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

  const starredRows = (["itpe", "bigdata", "gov"] as const).flatMap((examId) =>
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

  const wrongRows = (["itpe", "bigdata", "gov"] as const).flatMap((examId) =>
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

  for (const examId of ["itpe", "bigdata", "gov"] as const) {
    for (const [questionId, stat] of Object.entries(
      snapshot.userState.questionStatsByExam[examId],
    )) {
      await prisma.questionStat.upsert({
        where: {
          userId_examId_questionId: {
            userId,
            examId: toPrismaExamId(examId),
            questionId,
          },
        },
        create: {
          userId,
          examId: toPrismaExamId(examId),
          questionId,
          solvedCount: stat.solvedCount,
          wrongCount: stat.wrongCount,
          correctStreak: stat.correctStreak,
          lastSolvedAt: stat.lastSolvedAt ? new Date(stat.lastSolvedAt) : null,
          nextReviewAt: stat.nextReviewAt ? new Date(stat.nextReviewAt) : null,
          year: stat.year,
          round: stat.round,
          type: stat.type,
          subjectType: stat.subjectType,
        },
        update: {
          solvedCount: stat.solvedCount,
          wrongCount: stat.wrongCount,
          correctStreak: stat.correctStreak,
          lastSolvedAt: stat.lastSolvedAt ? new Date(stat.lastSolvedAt) : null,
          nextReviewAt: stat.nextReviewAt ? new Date(stat.nextReviewAt) : null,
          year: stat.year,
          round: stat.round,
          type: stat.type,
          subjectType: stat.subjectType,
        },
      });
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
