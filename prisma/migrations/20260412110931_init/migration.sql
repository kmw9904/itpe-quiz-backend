-- CreateEnum
CREATE TYPE "ExamId" AS ENUM ('itpe', 'bigdata', 'gov');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "importVersion" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'signup-local-import',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarredQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" "ExamId" NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarredQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrongQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" "ExamId" NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WrongQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" "ExamId" NOT NULL,
    "questionId" TEXT NOT NULL,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSolvedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "subjectType" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" "ExamId" NOT NULL,
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "examResultId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "wrongQids" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "subjectScores" JSONB,
    "perQuestionSnapshot" JSONB,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InProgressSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" "ExamId" NOT NULL,
    "mode" TEXT NOT NULL,
    "deckIds" TEXT[],
    "index" INTEGER NOT NULL,
    "activeExam" JSONB,
    "perQuestion" JSONB,
    "examSessionWrongQids" TEXT[],
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InProgressSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "MigrationLog_userId_importedAt_idx" ON "MigrationLog"("userId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationLog_userId_deviceId_importVersion_key" ON "MigrationLog"("userId", "deviceId", "importVersion");

-- CreateIndex
CREATE INDEX "StarredQuestion_userId_examId_idx" ON "StarredQuestion"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "StarredQuestion_userId_examId_questionId_key" ON "StarredQuestion"("userId", "examId", "questionId");

-- CreateIndex
CREATE INDEX "WrongQuestion_userId_examId_idx" ON "WrongQuestion"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestion_userId_examId_questionId_key" ON "WrongQuestion"("userId", "examId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionStat_userId_examId_idx" ON "QuestionStat"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionStat_userId_examId_questionId_key" ON "QuestionStat"("userId", "examId", "questionId");

-- CreateIndex
CREATE INDEX "ExamResult_userId_examId_idx" ON "ExamResult"("userId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_userId_examId_year_round_key" ON "ExamResult"("userId", "examId", "year", "round");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_examResultId_attemptNo_key" ON "ExamAttempt"("examResultId", "attemptNo");

-- CreateIndex
CREATE INDEX "InProgressSession_userId_savedAt_idx" ON "InProgressSession"("userId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InProgressSession_userId_examId_mode_key" ON "InProgressSession"("userId", "examId", "mode");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationLog" ADD CONSTRAINT "MigrationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarredQuestion" ADD CONSTRAINT "StarredQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestion" ADD CONSTRAINT "WrongQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStat" ADD CONSTRAINT "QuestionStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InProgressSession" ADD CONSTRAINT "InProgressSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
