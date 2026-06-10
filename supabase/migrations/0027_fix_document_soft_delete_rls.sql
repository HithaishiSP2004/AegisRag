-- ============================================================
-- Migration 0027: Fix document soft-delete RLS
--
-- ROOT CAUSE
-- ──────────
-- softDeleteDocument() runs:
--   UPDATE documents SET status = 'deleted' WHERE id = ?
--
-- The existing "documents_update_authorized" policy USING clause is:
--   org_id = auth_user_org_id()
--   AND (uploaded_by = auth.uid() OR auth_user_role() = 'super_admin')
--
-- Because there is no explicit WITH CHECK, PostgreSQL reuses the USING
-- expression as WITH CHECK on the post-update row. This means only the
-- original uploader or a super_admin can flip any column — including status.
--
-- Affected roles: compliance_officer deleting a document they did NOT
-- upload (e.g. another team member's upload). The USING passes the
-- pre-update row visibility check but WITH CHECK rejects the mutation.
--
-- FIX
-- ───
-- Split the policy into a permissive USING (who can see the row to update)
-- and an explicit WITH CHECK (what state the row may transition to).
-- Also add a dedicated narrow policy for soft-delete so compliance_officer
-- can mark any org document as deleted — matching the insert grant they
-- already hold.
-- ============================================================

DROP POLICY IF EXISTS "documents_update_authorized" ON documents;

-- General update policy: uploader edits their own doc; super_admin edits any.
-- WITH CHECK ensures the row stays in the same org after update.
CREATE POLICY "documents_update_authorized"
  ON documents FOR UPDATE
  USING (
    org_id = auth_user_org_id()
    AND (
      uploaded_by = auth.uid()
      OR auth_user_role() = 'super_admin'
    )
  )
  WITH CHECK (
    org_id = auth_user_org_id()
  );

-- Soft-delete policy: compliance_officer and super_admin may set
-- status = 'deleted' on any document within their org.
CREATE POLICY "documents_soft_delete_authorized"
  ON documents FOR UPDATE
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  )
  WITH CHECK (
    org_id = auth_user_org_id()
    AND status = 'deleted'
  );
