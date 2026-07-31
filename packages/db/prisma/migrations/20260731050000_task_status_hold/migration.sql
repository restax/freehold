-- A fourth task status: on hold, deliberately parked (distinct from SKIPPED
-- "canceled" and plain OPEN). Excluded from "open" counts the same as SKIPPED.
ALTER TYPE "TaskStatus" ADD VALUE 'HOLD';
