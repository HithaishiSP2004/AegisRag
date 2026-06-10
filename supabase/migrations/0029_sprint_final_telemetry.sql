-- ============================================================
-- Migration 0029: Sprint Final Telemetry and Audit Tables
-- ============================================================

-- Alter existing security_events table to conform to required telemetry columns
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS framework VARCHAR(100);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS control_id VARCHAR(100);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- Populate tenant_id with org_id for existing records
UPDATE security_events SET tenant_id = org_id WHERE tenant_id IS NULL;

-- 1. compliance_events
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  framework VARCHAR(100),
  control_id VARCHAR(100),
  evidence_count INT DEFAULT 0,
  coverage_change NUMERIC(5,2) DEFAULT 0.00,
  status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. retrieval_events
CREATE TABLE IF NOT EXISTS retrieval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT,
  mode VARCHAR(50),
  groundedness NUMERIC(4,3),
  latency_ms INT,
  hallucination_detected BOOLEAN DEFAULT false,
  citation_accuracy NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. governance_events
CREATE TABLE IF NOT EXISTS governance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  model VARCHAR(100),
  tokens INT DEFAULT 0,
  cost NUMERIC(10, 6) DEFAULT 0.000000,
  fallback_triggered BOOLEAN DEFAULT false,
  violation_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. executive_snapshots
CREATE TABLE IF NOT EXISTS executive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  risk_score NUMERIC(5,2),
  compliance_coverage NUMERIC(5,2),
  audit_readiness NUMERIC(5,2),
  groundedness NUMERIC(4,3),
  hallucination_rate NUMERIC(5,2),
  security_alerts INT DEFAULT 0,
  evidence_health NUMERIC(5,2),
  snapshot_date DATE DEFAULT CURRENT_DATE
);

-- 5. analytics_narratives
CREATE TABLE IF NOT EXISTS analytics_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  report_type VARCHAR(100),
  period VARCHAR(50),
  content TEXT,
  hash VARCHAR(64),
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. audit_events
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(100),
  actor TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) policies
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "compliance_events_select" ON compliance_events FOR SELECT USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "retrieval_events_select" ON retrieval_events FOR SELECT USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "governance_events_select" ON governance_events FOR SELECT USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "executive_snapshots_select" ON executive_snapshots FOR SELECT USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "analytics_narratives_select" ON analytics_narratives FOR SELECT USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "audit_events_select" ON audit_events FOR SELECT USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

-- Insert policies (service role or authenticated users)
CREATE POLICY "compliance_events_insert" ON compliance_events FOR INSERT WITH CHECK (true);
CREATE POLICY "retrieval_events_insert" ON retrieval_events FOR INSERT WITH CHECK (true);
CREATE POLICY "governance_events_insert" ON governance_events FOR INSERT WITH CHECK (true);
CREATE POLICY "executive_snapshots_insert" ON executive_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_narratives_insert" ON analytics_narratives FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_events_insert" ON audit_events FOR INSERT WITH CHECK (true);
