-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "attempt_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "account_lockouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "locked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlocked_at" DATETIME,
    "unlocked_by" TEXT
);

-- CreateIndex
CREATE INDEX "idx_login_attempts_username" ON "login_attempts"("username");

-- CreateIndex
CREATE INDEX "idx_login_attempts_ip" ON "login_attempts"("ip_address");

-- CreateIndex
CREATE INDEX "idx_login_attempts_date" ON "login_attempts"("attempt_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "account_lockouts_username_key" ON "account_lockouts"("username");

-- CreateIndex
CREATE INDEX "idx_account_lockouts_username" ON "account_lockouts"("username");

-- CreateIndex
CREATE INDEX "idx_account_lockouts_until" ON "account_lockouts"("locked_until");
