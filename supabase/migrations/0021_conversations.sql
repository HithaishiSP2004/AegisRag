-- ============================================================
-- Migration 0021: conversations + messages (Sprint 3A)
-- Persistent chat history with org isolation and RBAC.
--
-- Depends on:
--   0015_fix_rls_recursion.sql  (auth_user_org_id, auth_user_role)
--   0001_organizations.sql      (organizations)
--   0002_user_profiles.sql      (user_profiles, user_role enum)
--
-- user_role enum values (from 0002_user_profiles.sql):
--   'super_admin' | 'compliance_officer' | 'security_analyst'
--   | 'auditor' | 'executive'
--
-- All RLS policies use auth_user_org_id() / auth_user_role()
-- — the SECURITY DEFINER helpers from 0015 — never raw
-- subqueries against user_profiles.
-- ============================================================

-- ── Conversations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES user_profiles(id)  ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New Conversation'
                         CHECK (char_length(title) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_org_user
  ON conversations(org_id, user_id, updated_at DESC);
CREATE INDEX idx_conversations_user
  ON conversations(user_id, updated_at DESC);

-- ── Messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  citations       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  retrieval_mode  TEXT        CHECK (retrieval_mode IN ('keyword', 'vector', 'hybrid')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation
  ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_org
  ON messages(org_id);

-- ── Auto-update conversations.updated_at on new message ──────
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

-- ── conversations policies ────────────────────────────────────

-- SELECT: own conversations, OR super_admin / compliance_officer
-- seeing all conversations in the org.
CREATE POLICY "conversations_select"
  ON conversations FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND (
      user_id = auth.uid()
      OR auth_user_role() IN ('super_admin', 'compliance_officer')
    )
  );

-- INSERT: authenticated user creating their own conversation in their org.
CREATE POLICY "conversations_insert"
  ON conversations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = auth_user_org_id()
  );

-- UPDATE: owner may rename their own conversation.
CREATE POLICY "conversations_update"
  ON conversations FOR UPDATE
  USING  (user_id = auth.uid() AND org_id = auth_user_org_id())
  WITH CHECK (user_id = auth.uid() AND org_id = auth_user_org_id());

-- DELETE: owner deletes own; super_admin may delete any in the org.
CREATE POLICY "conversations_delete"
  ON conversations FOR DELETE
  USING (
    org_id = auth_user_org_id()
    AND (
      user_id = auth.uid()
      OR auth_user_role() = 'super_admin'
    )
  );

-- ── messages policies ─────────────────────────────────────────

-- SELECT: messages belonging to conversations the caller may see.
--   Uses the same org + owner-or-privileged logic; avoids a
--   correlated subquery on conversations by checking org_id and
--   resolving ownership through the conversation_id join inline.
CREATE POLICY "messages_select"
  ON messages FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE org_id = auth_user_org_id()
        AND (
          user_id = auth.uid()
          OR auth_user_role() IN ('super_admin', 'compliance_officer')
        )
    )
  );

-- INSERT: user may only write messages into their own conversations
-- within their org. The chat API route does this after verifying
-- conversation ownership server-side.
CREATE POLICY "messages_insert"
  ON messages FOR INSERT
  WITH CHECK (
    org_id = auth_user_org_id()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE user_id = auth.uid()
        AND org_id = auth_user_org_id()
    )
  );

-- ── VERIFICATION ─────────────────────────────────────────────
-- Expected: 2 tables created
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages')
ORDER BY tablename;

-- Expected: 6 policies (4 on conversations, 2 on messages)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;
