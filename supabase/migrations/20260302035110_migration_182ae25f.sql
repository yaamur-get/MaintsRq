-- Create approval_links table for beneficiary approval and funding selection
CREATE TABLE IF NOT EXISTS approval_links (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  beneficiary_phone text NOT NULL,
  is_used boolean DEFAULT false,
  approved boolean DEFAULT NULL,
  funding_type funding_type DEFAULT NULL,
  approved_at timestamp with time zone DEFAULT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_approval_links_token ON approval_links(token);
CREATE INDEX IF NOT EXISTS idx_approval_links_request ON approval_links(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_links_phone ON approval_links(beneficiary_phone);

-- Insert Arabic translations for all statuses
INSERT INTO status_translations (status_key, arabic_label, color_class, display_order, is_active) VALUES
  ('pending_review', 'بانتظار مراجعة خدمة العملاء', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 1, true),
  ('accepted_initial', 'مقبول مبدئياً - بانتظار اعتماد مدير المشاريع', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 2, true),
  ('rejected', 'مرفوض', 'bg-gray-100 text-gray-800 border-gray-300', 3, true),
  ('approved', 'معتمد من مدير المشاريع', 'bg-charity-light text-white border-charity-primary', 4, true),
  ('pending_inspection', 'بانتظار المعاينة', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 5, true),
  ('pending_inspection_approval', 'بانتظار اعتماد تقرير المعاينة', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 6, true),
  ('pending_expert_pricing', 'بانتظار تسعير الخبير', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 7, true),
  ('pending_pricing_approval', 'بانتظار اعتماد التسعير', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 8, true),
  ('pending_beneficiary_approval', 'بانتظار موافقة المستفيد', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 9, true),
  ('pending_funding', 'بانتظار اكتمال التمويل', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 10, true),
  ('funding_completed', 'اكتمل التمويل', 'bg-charity-primary text-white border-charity-primary', 11, true),
  ('pending_contractor_bids', 'بانتظار عروض المقاولين', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 12, true),
  ('pending_final_approval', 'بانتظار الموافقة النهائية', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 13, true),
  ('in_progress', 'قيد التنفيذ', 'bg-charity-primary text-white border-charity-primary', 14, true),
  ('pending_final_report', 'بانتظار التقرير الختامي', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 15, true),
  ('pending_closure', 'بانتظار الإغلاق', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 16, true),
  ('closed', 'مغلق', 'bg-charity-dark text-white border-charity-dark', 17, true),
  ('cancelled', 'ملغى', 'bg-gray-100 text-gray-800 border-gray-300', 18, true)
ON CONFLICT (status_key) DO UPDATE SET
  arabic_label = EXCLUDED.arabic_label,
  color_class = EXCLUDED.color_class,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;