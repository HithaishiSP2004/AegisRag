-- ============================================================
-- Migration 0028: Fix document update RLS
-- ============================================================

DROP POLICY IF EXISTS "documents_update_authorized" ON documents;
DROP POLICY IF EXISTS "documents_soft_delete_authorized" ON documents;

CREATE POLICY "documents_update_authorized"
ON documents
FOR UPDATE
USING (
  org_id = auth_user_org_id()
  AND (
    uploaded_by = auth.uid()
    OR auth_user_role() IN (
      'super_admin',
      'compliance_officer'
    )
  )
)
WITH CHECK (
  org_id = auth_user_org_id()
);
