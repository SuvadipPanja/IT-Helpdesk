-- =============================================================================
-- Migration 06: CR Module Seed Data
-- Populates statuses, types, categories, sub-categories, and system settings.
-- Idempotent: safe to run multiple times.
-- =============================================================================

SET QUOTED_IDENTIFIER ON;

-- ===========================================================================
-- 1. CR STATUSES (11 lifecycle states)
-- ===========================================================================
IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'DRAFT')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Draft', 'DRAFT', '#6b7280', 0, 1);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'SUBMITTED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Submitted', 'SUBMITTED', '#3b82f6', 0, 2);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'UNDER_REVIEW')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Under Review', 'UNDER_REVIEW', '#8b5cf6', 0, 3);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'PENDING_APPROVAL')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Pending Approval', 'PENDING_APPROVAL', '#f59e0b', 0, 4);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'APPROVED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Approved', 'APPROVED', '#10b981', 0, 5);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'REJECTED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Rejected', 'REJECTED', '#ef4444', 1, 6);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'SCHEDULED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Scheduled', 'SCHEDULED', '#06b6d4', 0, 7);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'IN_PROGRESS')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'In Progress', 'IN_PROGRESS', '#f97316', 0, 8);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'IMPLEMENTED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Implemented', 'IMPLEMENTED', '#6366f1', 0, 9);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'CLOSED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Closed', 'CLOSED', '#22c55e', 1, 10);

IF NOT EXISTS (SELECT 1 FROM cr_statuses WHERE status_code = 'CANCELLED')
  INSERT INTO cr_statuses (status_name, status_code, color_code, is_final_status, display_order)
  VALUES (N'Cancelled', 'CANCELLED', '#9ca3af', 1, 11);

PRINT 'CR statuses seeded';

-- ===========================================================================
-- 2. CR TYPES (3 ITIL change types)
-- ===========================================================================
IF NOT EXISTS (SELECT 1 FROM cr_types WHERE type_code = 'STANDARD')
  INSERT INTO cr_types (type_name, type_code, description, requires_cab_approval, requires_manager_approval, default_risk_level, review_sla_hours)
  VALUES (N'Standard', 'STANDARD', N'Pre-approved, low-risk changes with established procedures', 0, 0, 'LOW', 24);

IF NOT EXISTS (SELECT 1 FROM cr_types WHERE type_code = 'NORMAL')
  INSERT INTO cr_types (type_name, type_code, description, requires_cab_approval, requires_manager_approval, default_risk_level, review_sla_hours)
  VALUES (N'Normal', 'NORMAL', N'Changes requiring assessment, approval, and scheduling', 1, 1, 'MEDIUM', 48);

IF NOT EXISTS (SELECT 1 FROM cr_types WHERE type_code = 'EMERGENCY')
  INSERT INTO cr_types (type_name, type_code, description, requires_cab_approval, requires_manager_approval, default_risk_level, review_sla_hours)
  VALUES (N'Emergency', 'EMERGENCY', N'Urgent changes needed to restore service or prevent imminent failure', 0, 1, 'HIGH', 4);

PRINT 'CR types seeded';

-- ===========================================================================
-- 3. CR CATEGORIES & SUB-CATEGORIES
-- ===========================================================================

-- Infrastructure
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'INFRASTRUCTURE')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Infrastructure', 'INFRASTRUCTURE', 'server', '#6366f1', 1);

-- Application
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'APPLICATION')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Application', 'APPLICATION', 'code', '#8b5cf6', 2);

-- Network
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'NETWORK')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Network', 'NETWORK', 'wifi', '#06b6d4', 3);

-- Database
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'DATABASE')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Database', 'DATABASE', 'database', '#f59e0b', 4);

-- Security
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'SECURITY')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Security', 'SECURITY', 'shield', '#ef4444', 5);

-- Cloud Services
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'CLOUD')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Cloud Services', 'CLOUD', 'cloud', '#3b82f6', 6);

-- Hardware
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'HARDWARE')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Hardware', 'HARDWARE', 'cpu', '#78716c', 7);

-- Other
IF NOT EXISTS (SELECT 1 FROM cr_categories WHERE category_code = 'OTHER')
  INSERT INTO cr_categories (category_name, category_code, icon, color_code, sort_order)
  VALUES (N'Other', 'OTHER', 'settings', '#9ca3af', 8);

PRINT 'CR categories seeded';

-- Sub-categories
-- Infrastructure subs
DECLARE @catId INT;

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'INFRASTRUCTURE';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Server Upgrade')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Server Upgrade');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'OS Patching')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'OS Patching');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Storage Expansion')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Storage Expansion');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Virtualization')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Virtualization');
END

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'APPLICATION';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Feature Release')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Feature Release');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Bug Fix')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Bug Fix');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Configuration Change')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Configuration Change');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Version Upgrade')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Version Upgrade');
END

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'NETWORK';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Firewall Rule Change')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Firewall Rule Change');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'DNS Change')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'DNS Change');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'VLAN Modification')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'VLAN Modification');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'VPN Configuration')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'VPN Configuration');
END

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'DATABASE';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Schema Change')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Schema Change');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Data Migration')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Data Migration');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Performance Tuning')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Performance Tuning');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Backup Configuration')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Backup Configuration');
END

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'SECURITY';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Access Control Change')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Access Control Change');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Certificate Update')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Certificate Update');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Security Patch')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Security Patch');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Policy Update')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Policy Update');
END

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'CLOUD';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Resource Scaling')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Resource Scaling');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Service Migration')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Service Migration');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Region Change')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Region Change');
END

SELECT @catId = category_id FROM cr_categories WHERE category_code = 'HARDWARE';
IF @catId IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Equipment Replacement')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Equipment Replacement');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Rack & Cable Management')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Rack & Cable Management');
  IF NOT EXISTS (SELECT 1 FROM cr_sub_categories WHERE category_id = @catId AND sub_category_name = N'Peripheral Installation')
    INSERT INTO cr_sub_categories (category_id, sub_category_name) VALUES (@catId, N'Peripheral Installation');
END

PRINT 'CR sub-categories seeded';

-- ===========================================================================
-- 4. SYSTEM SETTINGS FOR CR MODULE
-- ===========================================================================
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'system_settings')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_module_enabled')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_module_enabled', 'true', 'change_request', 'boolean', 'Enable/disable the Change Request module', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_number_prefix')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_number_prefix', 'CR', 'change_request', 'string', 'Prefix for CR numbers (e.g., CR-001)', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_auto_assign_reviewer')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_auto_assign_reviewer', 'false', 'change_request', 'boolean', 'Automatically assign a reviewer on submission', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_require_rollback_plan')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_require_rollback_plan', 'true', 'change_request', 'boolean', 'Require rollback plan before approval', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_require_test_plan')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_require_test_plan', 'true', 'change_request', 'boolean', 'Require test plan before approval', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_allow_self_approval')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_allow_self_approval', 'false', 'change_request', 'boolean', 'Allow requester to approve their own CR', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_emergency_bypass_cab')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_emergency_bypass_cab', 'true', 'change_request', 'boolean', 'Emergency CRs skip CAB and go to ECAB', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_standard_review_sla_hours')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_standard_review_sla_hours', '24', 'change_request', 'number', 'SLA hours for standard CR review', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_normal_review_sla_hours')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_normal_review_sla_hours', '48', 'change_request', 'number', 'SLA hours for normal CR review', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_emergency_review_sla_hours')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_emergency_review_sla_hours', '4', 'change_request', 'number', 'SLA hours for emergency CR review', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_approval_reminder_hours')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_approval_reminder_hours', '24', 'change_request', 'number', 'Send reminder after N hours without approval decision', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_max_reminders')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_max_reminders', '3', 'change_request', 'number', 'Maximum approval reminders before escalation', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_default_maintenance_window')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_default_maintenance_window', '02:00-06:00', 'change_request', 'string', 'Default maintenance window (24h format)', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_require_pir')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_require_pir', 'true', 'change_request', 'boolean', 'Require Post-Implementation Review before closing', 0);

  IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'cr_pir_auto_prompt_hours')
    INSERT INTO system_settings (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
    VALUES ('cr_pir_auto_prompt_hours', '48', 'change_request', 'number', 'Prompt for PIR N hours after implementation', 0);

  PRINT 'CR system settings seeded';
END
ELSE
  PRINT 'system_settings table not found — skipping CR settings';

-- ===========================================================================
-- DONE
-- ===========================================================================
PRINT '';
PRINT '=== Migration 06 complete: CR seed data loaded ===';
