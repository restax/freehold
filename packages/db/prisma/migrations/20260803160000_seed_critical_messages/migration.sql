-- The three launch broadcasts for the critical-messages nav widget, in
-- their intended sequence: remove sample data -> connect Claude once real
-- usage starts -> try OpenSign a few days after that. All editable
-- afterward through /admin/messages; this migration only seeds first drafts.
-- Message 2 gets a literal id so message 3 can chain off it in this same
-- INSERT (CriticalMessage has no DB-side id default, it's app-assigned).

INSERT INTO "critical_message" ("id", "title", "body", "link_url", "urgent", "trigger", "created_at", "updated_at")
VALUES (
  'c4a1a1a0-0001-4a1a-8a1a-000000000001',
  'Remove your sample data when you''re ready',
  'This workspace has sample clients and transactions to help you get a feel for Freehold. When you''re ready to add your own, remove the sample data first so your list only shows real files.',
  '/dashboard/import',
  false,
  'HAS_SAMPLE_DATA',
  now(),
  now()
);

INSERT INTO "critical_message" ("id", "title", "body", "link_url", "urgent", "trigger", "created_at", "updated_at")
VALUES (
  'c4a1a1a0-0002-4a1a-8a1a-000000000002',
  'Connect Claude to your workspace',
  'You''ve got real files moving now. Connect Claude Desktop or another MCP client to search transactions, check deadlines, and update files without leaving your chat.',
  '/dashboard/integrations',
  false,
  'FIFTH_REAL_TRANSACTION',
  now(),
  now()
);

INSERT INTO "critical_message" ("id", "title", "body", "link_url", "urgent", "trigger", "trigger_delay_days", "trigger_after_message_id", "created_at", "updated_at")
VALUES (
  'c4a1a1a0-0003-4a1a-8a1a-000000000003',
  'Send documents for signature with OpenSign',
  'Freehold includes e-signatures through OpenSign at no extra cost, no separate account or per-envelope fee. Send a contract or disclosure for signature straight from an attachment.',
  '/dashboard/integrations',
  false,
  'DAYS_AFTER_MESSAGE',
  5,
  'c4a1a1a0-0002-4a1a-8a1a-000000000002',
  now(),
  now()
);
