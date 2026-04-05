-- AlterEnum: Add undo-related audit actions
ALTER TYPE "AuditAction" ADD VALUE 'CORRECT_RESULT';
ALTER TYPE "AuditAction" ADD VALUE 'RE_EXECUTE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_NOTES';
