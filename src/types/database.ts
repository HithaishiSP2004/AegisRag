// AegisRAG Database Types - Sprint 3A
// Covers all tables from migrations 0001-0022.
// All tables include Relationships: [] as required by @supabase/supabase-js GenericTable constraint.
// Replace with `npx supabase gen types typescript` after Supabase CLI setup.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Enum types
export type OrgPlan = 'free' | 'pro' | 'enterprise'
export type UserRole = 'super_admin' | 'compliance_officer' | 'security_analyst' | 'auditor' | 'executive' | 'trial_user' | 'academic_user' | 'approved_user' | 'enterprise_user'
export type PermissionAction = 'read' | 'write' | 'delete' | 'admin'
export type PermissionScope = 'org' | 'department' | 'document'
export type DocumentStatus = 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'indexed' | 'embedding_failed' | 'failed' | 'deleted'
export type DocumentClassification = 'global' | 'organization' | 'user'
export type DocumentFramework = 'GDPR' | 'HIPAA' | 'SOC2' | 'ISO27001' | 'NIST' | 'OWASP_LLM_TOP_10' | 'EU_AI_ACT' | 'SECURITY_FRAMEWORKS' | 'RESEARCH_PAPERS'
export type DocumentType = 'hr_policy' | 'security_policy' | 'compliance_manual' | 'legal' | 'vendor' | 'regulatory' | 'other'
export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted'
export type PageStatus = 'pending' | 'chunked' | 'embedded' | 'failed'
export type WorkflowStatus = 'pending' | 'retrieving' | 'analyzing' | 'generating' | 'complete' | 'failed'
export type ReportType = 'compliance' | 'risk' | 'audit' | 'security'
export type ReportStatus = 'generating' | 'complete' | 'failed'
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low'
export type SecurityEventType = 'prompt_injection' | 'jailbreak_attempt' | 'unauthorized_access' | 'hallucination_detected' | 'rate_limit_exceeded' | 'auth_failure'
export type SecurityEventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AlertStatus   = 'open' | 'acknowledged' | 'resolved' | 'suppressed'
export type AlertCategory = 'security' | 'compliance' | 'governance' | 'risk' | 'system'
export type ReviewStatus  = 'pending' | 'approved' | 'rejected' | 'needs_followup'
export type EvidenceType  = 'audit_logs' | 'security_alerts' | 'security_events' | 'retrieval_evals' | 'documents' | 'ai_requests'
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'
export type RiskLevel     = 'critical' | 'high' | 'moderate' | 'low'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: OrgPlan
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: OrgPlan
          settings?: Json
        }
        Update: {
          name?: string
          slug?: string
          plan?: OrgPlan
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }

      user_profiles: {
        Row: {
          id: string
          org_id: string
          full_name: string | null
          role: UserRole
          department: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          full_name?: string | null
          role?: UserRole
          department?: string | null
          avatar_url?: string | null
          is_active?: boolean
        }
        Update: {
          full_name?: string | null
          role?: UserRole
          department?: string | null
          avatar_url?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }

      roles: {
        Row: {
          id: string
          org_id: string
          name: UserRole
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: UserRole
          description?: string | null
        }
        Update: {
          description?: string | null
        }
        Relationships: []
      }

      permissions: {
        Row: {
          id: string
          role_id: string
          resource: string
          action: PermissionAction
          scope: PermissionScope
          created_at: string
        }
        Insert: {
          id?: string
          role_id: string
          resource: string
          action: PermissionAction
          scope: PermissionScope
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      user_roles: {
        Row: {
          user_id: string
          role_id: string
          granted_by: string | null
          granted_at: string
        }
        Insert: {
          user_id: string
          role_id: string
          granted_by?: string | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      documents: {
        Row: {
          id: string
          org_id: string
          uploaded_by: string
          filename: string
          original_name: string
          storage_path: string
          file_size_bytes: number
          page_count: number
          status: DocumentStatus
          doc_type: DocumentType
          department: string | null
          sensitivity: SensitivityLevel
          classification: DocumentClassification
          framework: DocumentFramework | null
          metadata: Json
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          uploaded_by: string
          filename: string
          original_name: string
          storage_path: string
          file_size_bytes?: number
          page_count?: number
          status?: DocumentStatus
          doc_type?: DocumentType
          department?: string | null
          sensitivity?: SensitivityLevel
          classification?: DocumentClassification
          framework?: DocumentFramework | null
          metadata?: Json
          error_message?: string | null
        }
        Update: {
          status?: DocumentStatus
          page_count?: number
          classification?: DocumentClassification
          framework?: DocumentFramework | null
          metadata?: Json
          error_message?: string | null
          updated_at?: string
          storage_path?: string
          filename?: string
          file_size_bytes?: number
        }
        Relationships: []
      }

      document_versions: {
        Row: {
          id: string
          document_id: string
          version_number: number
          storage_path: string
          file_size_bytes: number
          page_count: number
          change_summary: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          version_number: number
          storage_path: string
          file_size_bytes?: number
          page_count?: number
          change_summary?: string | null
          created_by: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      pages: {
        Row: {
          id: string
          document_id: string
          org_id: string
          page_number: number
          raw_text: string | null
          word_count: number
          status: PageStatus
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          org_id: string
          page_number: number
          raw_text?: string | null
          word_count?: number
          status?: PageStatus
          error_message?: string | null
        }
        Update: {
          raw_text?: string | null
          word_count?: number
          status?: PageStatus
          error_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      chunks: {
        Row: {
          id: string
          document_id: string
          page_id: string
          org_id: string
          chunk_index: number
          content: string
          token_count: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          page_id: string
          org_id: string
          chunk_index: number
          content: string
          token_count?: number
          metadata?: Json
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      embeddings: {
        Row: {
          id: string
          chunk_id: string
          org_id: string
          embedding: number[]
          model_used: string
          created_at: string
        }
        Insert: {
          id?: string
          chunk_id: string
          org_id: string
          embedding: number[]
          model_used?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      workflows: {
        Row: {
          id: string
          org_id: string
          created_by: string
          input_document_id: string | null
          name: string
          status: WorkflowStatus
          progress_pct: number
          current_step: string | null
          result_summary: string | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          created_by: string
          input_document_id?: string | null
          name: string
          status?: WorkflowStatus
          progress_pct?: number
          current_step?: string | null
        }
        Update: {
          status?: WorkflowStatus
          progress_pct?: number
          current_step?: string | null
          result_summary?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      reports: {
        Row: {
          id: string
          workflow_id: string
          org_id: string
          created_by: string
          title: string
          report_type: ReportType
          compliance_score: number | null
          risk_score: number | null
          status: ReportStatus
          content: Json
          ai_model_used: string | null
          fallback_used: boolean
          fallback_level: number | null
          confidence_score: number | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          org_id: string
          created_by: string
          title: string
          report_type: ReportType
          compliance_score?: number | null
          risk_score?: number | null
          status?: ReportStatus
          content?: Json
          ai_model_used?: string | null
          fallback_used?: boolean
          fallback_level?: number | null
          confidence_score?: number | null
        }
        Update: {
          compliance_score?: number | null
          risk_score?: number | null
          status?: ReportStatus
          content?: Json
          ai_model_used?: string | null
          fallback_used?: boolean
          fallback_level?: number | null
          confidence_score?: number | null
          error_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      violations: {
        Row: {
          id: string
          report_id: string
          org_id: string
          clause_text: string
          policy_reference: string | null
          severity: ViolationSeverity
          description: string
          recommendation: string | null
          evidence_chunk_ids: string[]
          confidence_score: number | null
          severity_weight: number
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          org_id: string
          clause_text: string
          policy_reference?: string | null
          severity: ViolationSeverity
          description: string
          recommendation?: string | null
          evidence_chunk_ids?: string[]
          confidence_score?: number | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      audit_logs: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      security_events: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          event_type: SecurityEventType
          severity: SecurityEventSeverity
          description: string
          raw_input_hash: string | null
          blocked: boolean
          resolution: string | null
          is_demo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          event_type: SecurityEventType
          severity: SecurityEventSeverity
          description: string
          raw_input_hash?: string | null
          blocked?: boolean
          resolution?: string | null
          is_demo?: boolean
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      ai_requests: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          workflow_id: string | null
          model_used: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          latency_ms: number
          fallback_level: number
          success: boolean
          error_code: string | null
          error_message: string | null
          call_type: 'embedding' | 'completion' | 'rerank'
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          workflow_id?: string | null
          model_used: string
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
          latency_ms?: number
          fallback_level?: number
          success?: boolean
          error_code?: string | null
          error_message?: string | null
          call_type?: 'embedding' | 'completion' | 'rerank'
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      conversations: {
        Row: {
          id:         string
          org_id:     string
          user_id:    string
          title:      string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?:        string
          org_id:     string
          user_id:    string
          title?:     string
        }
        Update: {
          title?:      string
          updated_at?: string
        }
        Relationships: []
      }

      messages: {
        Row: {
          id:              string
          conversation_id: string
          org_id:          string
          role:            'user' | 'assistant'
          content:         string
          citations:       Json
          retrieval_mode:  string | null
          created_at:      string
        }
        Insert: {
          id?:              string
          conversation_id:  string
          org_id:           string
          role:             'user' | 'assistant'
          content:          string
          citations?:       Json
          retrieval_mode?:  string | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      retrieval_evals: {
        Row: {
          id:                 string
          org_id:             string
          conversation_id:    string | null
          query_text:         string
          retrieval_mode:     'vector' | 'keyword' | 'hybrid'
          chunk_count:        number
          vector_latency_ms:  number | null
          keyword_latency_ms: number | null
          fusion_latency_ms:  number | null
          rerank_latency_ms:  number | null
          total_latency_ms:   number | null
          groundedness_score: number | null
          citation_hit_rate:  number | null
          hallucination_flag: boolean
          eval_notes:         string | null
          created_at:         string
          vector_candidates:  number | null
          reranked_candidates: number | null
          context_tokens_saved: number | null
        }
        Insert: {
          id?:                 string
          org_id:              string
          conversation_id?:    string | null
          query_text:          string
          retrieval_mode:      'vector' | 'keyword' | 'hybrid'
          chunk_count?:        number
          vector_latency_ms?:  number | null
          keyword_latency_ms?: number | null
          fusion_latency_ms?:  number | null
          rerank_latency_ms?:  number | null
          total_latency_ms?:   number | null
          groundedness_score?: number | null
          citation_hit_rate?:  number | null
          hallucination_flag?: boolean
          eval_notes?:         string | null
          vector_candidates?:  number | null
          reranked_candidates?: number | null
          context_tokens_saved?: number | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      security_alerts: {
        Row: {
          id:               string
          org_id:           string
          source_event_id:  string | null
          title:            string
          description:      string
          severity:         AlertSeverity
          status:           AlertStatus
          category:         AlertCategory
          acknowledged_by:  string | null
          acknowledged_at:  string | null
          resolved_at:      string | null
          resolution_note:  string | null
          metadata:         Json
          created_at:       string
          updated_at:       string
        }
        Insert: {
          id?:              string
          org_id:           string
          source_event_id?: string | null
          title:            string
          description:      string
          severity:         AlertSeverity
          status?:          AlertStatus
          category?:        AlertCategory
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_at?:     string | null
          resolution_note?: string | null
          metadata?:        Json
        }
        Update: {
          status?:          AlertStatus
          acknowledged_by?: string | null
          acknowledged_at?: string | null
          resolved_at?:     string | null
          resolution_note?: string | null
          updated_at?:      string
        }
        Relationships: []
      }

      document_risk_flags: {
        Row: {
          id:                    string
          org_id:                string
          document_id:           string
          declared_sensitivity:  string
          detected_sensitivity:  string
          mismatch_detected:     boolean
          risk_score:            number
          reasoning:             string | null
          reviewed:              boolean
          reviewed_by:           string | null
          reviewed_at:           string | null
          created_at:            string
        }
        Insert: {
          id?:                    string
          org_id:                 string
          document_id:            string
          declared_sensitivity:   string
          detected_sensitivity:   string
          mismatch_detected?:     boolean
          risk_score?:            number
          reasoning?:             string | null
          reviewed?:              boolean
          reviewed_by?:           string | null
          reviewed_at?:           string | null
        }
        Update: {
          reviewed?:    boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
        }
        Relationships: []
      }

      compliance_frameworks: {
        Row: {
          id:          string
          org_id:      string
          name:        string
          description: string
          created_at:  string
        }
        Insert: {
          id?:         string
          org_id:      string
          name:        string
          description?: string
        }
        Update: {
          name?:        string
          description?: string
        }
        Relationships: []
      }

      compliance_controls: {
        Row: {
          id:           string
          framework_id: string
          control_id:   string
          title:        string
          description:  string
          category:     string
          severity:     FindingSeverity
          created_at:   string
        }
        Insert: {
          id?:          string
          framework_id: string
          control_id:   string
          title:        string
          description?: string
          category?:    string
          severity?:    FindingSeverity
        }
        Update: {
          title?:       string
          description?: string
          category?:    string
          severity?:    FindingSeverity
        }
        Relationships: []
      }

      control_evidence: {
        Row: {
          id:                 string
          control_id:         string
          evidence_type:      EvidenceType
          evidence_reference: string
          source_table:       string
          source_id:          string
          created_at:         string
        }
        Insert: {
          id?:                string
          control_id:         string
          evidence_type:      EvidenceType
          evidence_reference?: string
          source_table:       string
          source_id:          string
        }
        Update: Record<string, never>
        Relationships: []
      }

      control_reviews: {
        Row: {
          id:               string
          control_id:       string
          reviewer_id:      string
          status:           ReviewStatus
          notes:            string | null
          review_date:      string | null
          next_review_date: string | null
          created_at:       string
          updated_at:       string
        }
        Insert: {
          id?:               string
          control_id:        string
          reviewer_id:       string
          status?:           ReviewStatus
          notes?:            string | null
          review_date?:      string | null
          next_review_date?: string | null
        }
        Update: {
          status?:           ReviewStatus
          notes?:            string | null
          review_date?:      string | null
          next_review_date?: string | null
          updated_at?:       string
        }
        Relationships: []
      }
    }

    Views: {
      audit_timeline: {
        Row: {
          id:            string
          org_id:        string
          user_id:       string | null
          actor_name:    string | null
          actor_email:   string | null
          actor_role:    string | null
          action:        string
          resource_type: string
          resource_id:   string | null
          new_value:     Json | null
          old_value:     Json | null
          ip_address:    string | null
          created_at:    string
        }
        Insert: never
        Update: never
        Relationships: []
      }

      security_timeline: {
        Row: {
          id:          string
          org_id:      string
          user_id:     string | null
          source_type: 'audit' | 'security' | 'retrieval'
          event_label: string
          category:    string
          severity:    string | null
          blocked:     boolean | null
          created_at:  string
        }
        Insert: never
        Update: never
        Relationships: []
      }

      compliance_timeline: {
        Row: {
          id:             string
          org_id:         string
          user_id:        string | null
          source_type:    'audit' | 'security' | 'alert' | 'review'
          event_label:    string
          category:       string
          severity:       string | null
          framework_name: string | null
          control_id:     string | null
          created_at:     string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }

    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[]
          match_org_id: string
          match_count?: number
          match_threshold?: number
          filter_department?: string | null
          filter_doc_type?: string | null
          filter_sensitivity?: string | null
        }
        Returns: {
          chunk_id: string
          document_id: string
          page_id: string
          org_id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }

      get_corpus_stats: {
        Args: { p_org_id: string }
        Returns: {
          total_documents: number
          total_pages: number
          total_chunks: number
          total_embeddings: number
        }[]
      }

      compute_risk_score: {
        Args: { p_report_id: string }
        Returns: number
      }

      log_audit_event: {
        Args: {
          p_org_id: string
          p_user_id: string | null
          p_action: string
          p_resource_type: string
          p_resource_id?: string | null
          p_old_value?: Json | null
          p_new_value?: Json | null
          p_ip_address?: string | null
          p_user_agent?: string | null
        }
        Returns: string
      }

      get_security_stats: {
        Args: { p_org_id: string; p_hours?: number }
        Returns: {
          total_events: number
          blocked_events: number
          injection_attempts: number
          unauthorized_attempts: number
          critical_events: number
          events_last_n_hours: number
        }[]
      }

      get_token_usage_stats: {
        Args: { p_org_id: string }
        Returns: {
          total_prompt_tokens: number
          total_completion_tokens: number
          total_tokens_all: number
          avg_latency_ms: number
          fallback_rate_pct: number
          total_calls: number
          failed_calls: number
        }[]
      }

      get_retrieval_stats: {
        Args: { p_org_id: string; p_days?: number }
        Returns: {
          total_queries:          number
          hybrid_pct:             number
          vector_pct:             number
          keyword_pct:            number
          avg_groundedness:       number
          avg_citation_hit_rate:  number
          hallucination_rate_pct: number
          avg_total_latency_ms:   number
          avg_vector_latency_ms:  number
          avg_keyword_latency_ms: number
          avg_chunk_count:        number
        }[]
      }

      get_security_kpi: {
        Args: { p_org_id: string; p_days?: number }
        Returns: {
          open_alerts:          number
          critical_open:        number
          high_open:            number
          alerts_last_n_days:   number
          resolved_last_n_days: number
          risk_flags_open:      number
          avg_resolve_hours:    number | null
        }[]
      }

      get_compliance_evidence: {
        Args: { p_org_id: string; p_from?: string; p_to?: string }
        Returns: Json
      }

      get_compliance_stats: {
        Args: { p_org_id: string }
        Returns: {
          total_frameworks:          number
          total_controls:            number
          controls_with_evidence:    number
          controls_missing_evidence: number
          reviews_pending:           number
          reviews_overdue:           number
          reviews_approved:          number
        }[]
      }

      get_org_risk_score: {
        Args: { p_org_id: string }
        Returns: {
          risk_score:          number
          risk_level:          RiskLevel
          open_alerts:         number
          critical_alerts:     number
          hallucinations:      number
          retrieval_failures:  number
          failed_reviews:      number
          unauthorized_events: number
        }[]
      }

      seed_compliance_frameworks: {
        Args: { p_org_id: string }
        Returns: void
      }
    }
  }
}
