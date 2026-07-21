-- Harden the two-sided vendor RLS so the DB pins BOTH sides of a write, not just
-- the session's own side. The prior WITH CHECK — `tenant_id = app.tenant_id OR
-- vendor_id = app.vendor_id` — pins whichever side matches the session var but
-- leaves the other side free, so a vendor session could insert a row naming a
-- victim tenant (vendor_id matches, tenant_id unchecked), and a tenant session a
-- row naming any vendor. The app already prevents this; these policies make the
-- database prevent it too — the seam the plan flagged (engagement's flaw).

-- vendor_order: only the coordinator side creates orders (vendors just update
-- them), so INSERT is tenant-pinned. Reads, updates, and deletes stay two-sided.
DROP POLICY IF EXISTS "vendor_order_party_isolation" ON "vendor_order";

CREATE POLICY "vendor_order_read" ON "vendor_order" FOR SELECT
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  );
CREATE POLICY "vendor_order_update" ON "vendor_order" FOR UPDATE
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  );
CREATE POLICY "vendor_order_delete" ON "vendor_order" FOR DELETE
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  );
CREATE POLICY "vendor_order_insert" ON "vendor_order" FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- vendor_order_event and vendor_order_message carry a denormalized
-- (tenant_id, vendor_id) copied from their parent order. Pin both to the parent:
-- a writer must be a party (the OR), AND the pair must match the order exactly.
-- The subquery is itself RLS-filtered, so a forger can't even see a parent that
-- isn't theirs. This closes the free-side hole in both directions.
DROP POLICY IF EXISTS "vendor_order_event_party_isolation" ON "vendor_order_event";
CREATE POLICY "vendor_order_event_party_isolation" ON "vendor_order_event"
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  )
  WITH CHECK (
    (
      tenant_id = current_setting('app.tenant_id', true)
      OR vendor_id = current_setting('app.vendor_id', true)
    )
    AND EXISTS (
      SELECT 1 FROM "vendor_order" o
      WHERE o.id = "vendor_order_event".order_id
        AND o.tenant_id = "vendor_order_event".tenant_id
        AND o.vendor_id IS NOT DISTINCT FROM "vendor_order_event".vendor_id
    )
  );

DROP POLICY IF EXISTS "vendor_order_message_party_isolation" ON "vendor_order_message";
CREATE POLICY "vendor_order_message_party_isolation" ON "vendor_order_message"
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  )
  WITH CHECK (
    (
      tenant_id = current_setting('app.tenant_id', true)
      OR vendor_id = current_setting('app.vendor_id', true)
    )
    AND EXISTS (
      SELECT 1 FROM "vendor_order" o
      WHERE o.id = "vendor_order_message".order_id
        AND o.tenant_id = "vendor_order_message".tenant_id
        AND o.vendor_id IS NOT DISTINCT FROM "vendor_order_message".vendor_id
    )
  );
