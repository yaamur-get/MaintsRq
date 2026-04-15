DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'request_status'
      AND e.enumlabel = 'pending_rejection_approval'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'pending_rejection_approval' AFTER 'accepted_initial';
  END IF;
END $$;

INSERT INTO status_translations (status_key, arabic_label, color_class, display_order, is_active)
VALUES (
  'pending_rejection_approval',
  'مرفوض من خدمة العملاء - بانتظار تأكيد مدير المشاريع',
  'bg-rose-100 text-rose-800 border-rose-200',
  3,
  true
)
ON CONFLICT (status_key)
DO UPDATE SET
  arabic_label = EXCLUDED.arabic_label,
  color_class = EXCLUDED.color_class,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;
