-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliverableStatusOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "source" TEXT,
    "estimatedValue" REAL,
    "notes" TEXT,
    "lastContactedAt" DATETIME,
    "nextFollowUpAt" DATETIME,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "stageId" TEXT NOT NULL,
    "assignedToId" TEXT,
    CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "mainContactName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "monthlyRetainer" REAL,
    "contractStart" DATETIME,
    "contractEnd" DATETIME,
    "paymentStatus" TEXT NOT NULL DEFAULT 'CURRENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fromLeadId" TEXT,
    CONSTRAINT "Client_fromLeadId_fkey" FOREIGN KEY ("fromLeadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shootDate" DATETIME,
    "shootTime" TEXT,
    "shootLocation" TEXT,
    "projectType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "deadline" DATETIME,
    "internalNotes" TEXT,
    "clientNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "videographerId" TEXT,
    "photographerId" TEXT,
    "editorId" TEXT,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_videographerId_fkey" FOREIGN KEY ("videographerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "customTypeName" TEXT,
    "deadline" DATETIME,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryLink" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "assignedEditorId" TEXT,
    "statusId" TEXT NOT NULL,
    CONSTRAINT "Deliverable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deliverable_assignedEditorId_fkey" FOREIGN KEY ("assignedEditorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deliverable_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "DeliverableStatusOption" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Retainer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyRetainer" REAL NOT NULL,
    "shootsIncluded" INTEGER NOT NULL DEFAULT 0,
    "videosIncluded" INTEGER NOT NULL DEFAULT 0,
    "photosIncluded" INTEGER NOT NULL DEFAULT 0,
    "shootsUsed" INTEGER NOT NULL DEFAULT 0,
    "videosUsed" INTEGER NOT NULL DEFAULT 0,
    "photosUsed" INTEGER NOT NULL DEFAULT 0,
    "nextShootDate" DATETIME,
    "nextPaymentDate" DATETIME,
    "renewalDate" DATETIME,
    "servicesIncludedText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "Retainer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ONE_OFF',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATETIME,
    "dueDate" DATETIME,
    "paidDate" DATETIME,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "notes" TEXT,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" TEXT,
    "clientId" TEXT,
    "createdById" TEXT,
    CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_LeadServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_LeadServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_LeadServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ClientServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ClientServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClientServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "Lead_stageId_idx" ON "Lead"("stageId");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_fromLeadId_key" ON "Client"("fromLeadId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_shootDate_idx" ON "Project"("shootDate");

-- CreateIndex
CREATE INDEX "Deliverable_clientId_idx" ON "Deliverable"("clientId");

-- CreateIndex
CREATE INDEX "Deliverable_projectId_idx" ON "Deliverable"("projectId");

-- CreateIndex
CREATE INDEX "Deliverable_statusId_idx" ON "Deliverable"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "Retainer_clientId_key" ON "Retainer"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_clientId_idx" ON "Activity"("clientId");

-- CreateIndex
CREATE INDEX "Activity_dueAt_idx" ON "Activity"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "_LeadServices_AB_unique" ON "_LeadServices"("A", "B");

-- CreateIndex
CREATE INDEX "_LeadServices_B_index" ON "_LeadServices"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ClientServices_AB_unique" ON "_ClientServices"("A", "B");

-- CreateIndex
CREATE INDEX "_ClientServices_B_index" ON "_ClientServices"("B");
