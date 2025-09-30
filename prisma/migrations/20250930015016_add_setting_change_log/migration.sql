-- CreateTable
CREATE TABLE "setting_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setting_key" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "remarks" TEXT,
    CONSTRAINT "setting_change_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "idx_setting_change_logs_key" ON "setting_change_logs"("setting_key");

-- CreateIndex
CREATE INDEX "idx_setting_change_logs_user" ON "setting_change_logs"("changed_by");

-- CreateIndex
CREATE INDEX "idx_setting_change_logs_date" ON "setting_change_logs"("changed_at");
