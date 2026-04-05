-- CreateEnum
CREATE TYPE "TraceEventType" AS ENUM ('USER_MESSAGE', 'AI_RESPONSE', 'TOOL_CALL', 'TOOL_RESULT', 'PANEL_ACTION', 'API_CALL', 'ERROR');

-- CreateTable
CREATE TABLE "trace_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "event_type" "TraceEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "request_id" TEXT,
    "sequence_number" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trace_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trace_events_session_id_created_at_idx" ON "trace_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "trace_events_created_at_idx" ON "trace_events"("created_at");
