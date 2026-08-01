-- Who may use the Claude connector, and whether the workspace allows it at all.
--
-- Two levels, deliberately. The workspace switch belongs to the subscriber
-- paying for the account; the per-member grant belongs to whoever runs the
-- team day to day. Either one saying no is enough.

-- Off by default, including for every workspace that already exists.
-- Connecting an AI assistant to a workspace full of client addresses and deal
-- terms should be a decision someone makes on purpose, not one they discover
-- they already made because a deploy shipped it switched on.
ALTER TABLE "organization"
  ADD COLUMN "mcp_enabled" BOOLEAN NOT NULL DEFAULT false;

-- NULL means "follow the role" — owner and admin read and write, a plain
-- member reads only, a guest gets nothing. An explicit value overrides that:
-- 'none' cuts one person off without disturbing anyone else, 'read' and
-- 'write' set it outright.
--
-- Nullable rather than defaulted, so "never configured" and "deliberately set
-- to the same thing the role would have given" stay distinguishable. The Team
-- page shows those differently, and only one of them should survive a future
-- change to role defaults.
ALTER TABLE "member"
  ADD COLUMN "mcp_role" TEXT;
