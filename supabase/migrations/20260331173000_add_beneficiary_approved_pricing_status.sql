ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'beneficiary_approved_pricing';

INSERT INTO status_translations (status_key, arabic_label, color_class, display_order, is_active)
VALUES (
  'beneficiary_approved_pricing',
  'وافق المستفيد على المعاينة والتسعير',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  9,
  true
)
ON CONFLICT (status_key) DO UPDATE SET
  arabic_label = EXCLUDED.arabic_label,
  color_class = EXCLUDED.color_class,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;