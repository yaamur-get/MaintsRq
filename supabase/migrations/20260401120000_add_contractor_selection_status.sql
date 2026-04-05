-- Add pending_contractor_selection status to the request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'pending_contractor_selection';

-- Add Arabic translation for the new status
INSERT INTO status_translations (status_key, arabic_label, color_class, display_order, is_active) VALUES
  ('pending_contractor_selection', 'بانتظار اختيار المقاول', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 13, true)
ON CONFLICT (status_key) DO UPDATE SET
  arabic_label = EXCLUDED.arabic_label,
  color_class = EXCLUDED.color_class,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- Shift display_order for statuses after contractor_selection
UPDATE status_translations SET display_order = 14 WHERE status_key = 'pending_final_approval';
UPDATE status_translations SET display_order = 15 WHERE status_key = 'in_progress';
UPDATE status_translations SET display_order = 16 WHERE status_key = 'pending_final_report';
UPDATE status_translations SET display_order = 17 WHERE status_key = 'pending_closure';
UPDATE status_translations SET display_order = 18 WHERE status_key = 'closed';
UPDATE status_translations SET display_order = 19 WHERE status_key = 'cancelled';
