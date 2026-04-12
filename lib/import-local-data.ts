import type { Prisma } from "@prisma/client";
import { normalizeLocalSnapshot, toJson, toPrismaExamId } from "@/lib/local-data";

type Tx = Prisma.TransactionClient;

type ImportOptions = {
  userId: string;
  localSnapshot: unknown;
  deviceId?: string | null;
  importVersion?: number;
  source?: string;
  writeMigrationLog?: boolean;
  preventDuplicateImport?: boolean;
};

export async function mergeLocalSnapshotTx(tx: Tx, options: ImportOptions) {
  const snapshot = normalizeLocalSnapshot(options.localSnapshot);

  if (options.writeMigrationLog && options.preventDuplicateImport) {
    const existing = await tx.migrationLog.findFirst({
      where: {
        userId: options.userId,
        deviceId: options.deviceId ?? null,
        importVersion: options.importVersion ?? 1,
      },
    });

    if (existing) {
      return {
        imported: false,
        reason: "already_imported",
        snapshot,
      } as const;
    }
  }

  const starredRows = (["itpe", "bigdata", "gov"] as const).flatMap((examId) =>
    snapshot.userState.starredIdsByExam[examId].map((questionId) => ({
      userId: options.userId,
      examId: toPrismaExamId(examId),
      questionId,
    })),
  );

  if (starredRows.length > 0) {
    await tx.starredQuestion.createMany({
      data: starredRows,
      skipDuplicates: true,
    });
  }

  const wrongRows = (["itpe", "bigdata", "gov"] as const).flatMap((examId) =>
    snapshot.userState.wrongIdsByExam[examId].map((questionId) => ({
      userId: options.userId,
      examId: toPrismaExamId(examId),
      questionId,
    })),
  );

  if (wrongRows.length > 0) {
    await tx.wrongQuestion.createMany({
      data: wrongRows,
      skipDuplicates: true,
    });
  }

  for (const examId of ["itpe", "bigdata", "gov"] as const) {
    for (const [questionId, stat] of Object.entries(snapshot.userState.questionStatsByExam[examId])) {
      await tx.questionStat.upsert({
        where: {
          userId_examId_questionId: {
            userId: options.userId,
            examId: toPrismaExamId(examId),
            questionId,
          },
        },
        create: {
          userId: options.userId,
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
    const examResult = await tx.examResult.upsert({
      where: {
        userId_examId_year_round: {
          userId: options.userId,
          examId: toPrismaExamId(result.examId),
          year: result.year,
          round: result.round,
        },
      },
      create: {
        userId: options.userId,
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
      await tx.examAttempt.upsert({
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
          subjectScores: attempt.subjectScores ? toJson(attempt.subjectScores) : undefined,
          perQuestionSnapshot: attempt.perQuestionSnapshot ? toJson(attempt.perQuestionSnapshot) : undefined,
        },
        update: {
          score: attempt.score,
          total: attempt.total,
          passed: attempt.passed,
          wrongQids: attempt.wrongQids,
          createdAt: new Date(attempt.createdAt),
          subjectScores: attempt.subjectScores ? toJson(attempt.subjectScores) : undefined,
          perQuestionSnapshot: attempt.perQuestionSnapshot ? toJson(attempt.perQuestionSnapshot) : undefined,
        },
      });
    }
  }

  if (snapshot.inProgress) {
    await tx.inProgressSession.upsert({
      where: {
        userId_examId_mode: {
          userId: options.userId,
          examId: toPrismaExamId(snapshot.inProgress.examId),
          mode: snapshot.inProgress.mode,
        },
      },
      create: {
        userId: options.userId,
        examId: toPrismaExamId(snapshot.inProgress.examId),
        mode: snapshot.inProgress.mode,
        deckIds: snapshot.inProgress.deckIds,
        index: snapshot.inProgress.index,
        activeExam: snapshot.inProgress.activeExam ? toJson(snapshot.inProgress.activeExam) : undefined,
        perQuestion: toJson(snapshot.inProgress.perQuestion),
        examSessionWrongQids: snapshot.inProgress.examSessionWrongQids ?? [],
        savedAt: new Date(snapshot.inProgress.savedAt),
      },
      update: {
        deckIds: snapshot.inProgress.deckIds,
        index: snapshot.inProgress.index,
        activeExam: snapshot.inProgress.activeExam ? toJson(snapshot.inProgress.activeExam) : undefined,
        perQuestion: toJson(snapshot.inProgress.perQuestion),
        examSessionWrongQids: snapshot.inProgress.examSessionWrongQids ?? [],
        savedAt: new Date(snapshot.inProgress.savedAt),
      },
    });
  }

  if (options.writeMigrationLog) {
    await tx.migrationLog.create({
      data: {
        userId: options.userId,
        deviceId: options.deviceId ?? null,
        importVersion: options.importVersion ?? 1,
        source: options.source ?? "signup-local-import",
      },
    });
  }

  return {
    imported: true,
    snapshot,
  } as const;
}
