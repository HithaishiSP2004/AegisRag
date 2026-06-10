-- Migration 0033: Adjust tier_upgrade_requests schema to align with application expectations

-- 1. Add justification column if missing
ALTER TABLE tier_upgrade_requests ADD COLUMN IF NOT EXISTS justification TEXT;

-- 2. Add reviewed_by and reviewed_at columns if missing
ALTER TABLE tier_upgrade_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE tier_upgrade_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3. Make legacy not-null columns nullable to align with application logic
ALTER TABLE tier_upgrade_requests ALTER COLUMN name DROP NOT NULL;
ALTER TABLE tier_upgrade_requests ALTER COLUMN email DROP NOT NULL;
ALTER TABLE tier_upgrade_requests ALTER COLUMN role DROP NOT NULL;
ALTER TABLE tier_upgrade_requests ALTER COLUMN use_case DROP NOT NULL;
ALTER TABLE tier_upgrade_requests ALTER COLUMN expected_usage DROP NOT NULL;

-- 4. Enable RLS and recreate policies if they don't exist
ALTER TABLE tier_upgrade_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Select policy: users can read their own upgrade requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tier_upgrade_requests' AND policyname = 'upgrade_requests_select_own'
    ) THEN
        CREATE POLICY "upgrade_requests_select_own" ON tier_upgrade_requests
          FOR SELECT USING (user_id = auth.uid());
    END IF;

    -- Insert policy: authenticated users can insert their own upgrade requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tier_upgrade_requests' AND policyname = 'upgrade_requests_insert_own'
    ) THEN
        CREATE POLICY "upgrade_requests_insert_own" ON tier_upgrade_requests
          FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;

    -- Select policy for admins
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tier_upgrade_requests' AND policyname = 'upgrade_requests_select_admin'
    ) THEN
        CREATE POLICY "upgrade_requests_select_admin" ON tier_upgrade_requests
          FOR SELECT USING (auth_user_role() IN ('super_admin', 'compliance_officer'));
    END IF;

    -- Update policy for admins
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tier_upgrade_requests' AND policyname = 'upgrade_requests_update_admin'
    ) THEN
        CREATE POLICY "upgrade_requests_update_admin" ON tier_upgrade_requests
          FOR UPDATE USING (auth_user_role() IN ('super_admin', 'compliance_officer'))
          WITH CHECK (auth_user_role() IN ('super_admin', 'compliance_officer'));
    END IF;
END
$$;
