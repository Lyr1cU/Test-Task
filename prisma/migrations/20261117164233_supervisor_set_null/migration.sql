-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StaffMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL,
    "baseSalaryCents" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffMember_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "StaffMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StaffMember" ("baseSalaryCents", "companyId", "createdAt", "id", "joinedAt", "name", "supervisorId", "type") SELECT "baseSalaryCents", "companyId", "createdAt", "id", "joinedAt", "name", "supervisorId", "type" FROM "StaffMember";
DROP TABLE "StaffMember";
ALTER TABLE "new_StaffMember" RENAME TO "StaffMember";
CREATE INDEX "StaffMember_companyId_idx" ON "StaffMember"("companyId");
CREATE INDEX "StaffMember_supervisorId_idx" ON "StaffMember"("supervisorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
