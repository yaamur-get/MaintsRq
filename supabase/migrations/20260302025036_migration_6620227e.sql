-- إنشاء جدول ترجمات الحالات
CREATE TABLE IF NOT EXISTS status_translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status_key TEXT UNIQUE NOT NULL,
  arabic_label TEXT NOT NULL,
  color_class TEXT NOT NULL,
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة الترجمات
INSERT INTO status_translations (status_key, arabic_label, color_class, display_order) VALUES
('pending_review', 'بانتظار المراجعة', 'bg-orange-100 text-orange-800 border-orange-200', 1),
('accepted_initial', 'مقبول مبدئياً', 'bg-blue-100 text-blue-800 border-blue-200', 2),
('rejected', 'مرفوض', 'bg-red-100 text-red-800 border-red-200', 3),
('approved', 'معتمد', 'bg-charity-light text-white border-charity-light', 4),
('pending_inspection', 'بانتظار المعاينة', 'bg-yellow-100 text-yellow-800 border-yellow-200', 5),
('pending_inspection_approval', 'بانتظار اعتماد المعاينة', 'bg-purple-100 text-purple-800 border-purple-200', 6),
('pending_expert_pricing', 'بانتظار تسعير الخبير', 'bg-indigo-100 text-indigo-800 border-indigo-200', 7),
('pending_pricing_approval', 'بانتظار اعتماد التسعير', 'bg-pink-100 text-pink-800 border-pink-200', 8),
('pending_beneficiary_approval', 'بانتظار موافقة المستفيد', 'bg-amber-100 text-amber-800 border-amber-200', 9),
('pending_funding', 'بانتظار اكتمال المبلغ', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 10),
('pending_contractor_bids', 'بانتظار عروض المقاولين', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 11),
('pending_final_approval', 'بانتظار الاعتماد النهائي', 'bg-charity-bg-calm text-charity-dark border-charity-medium', 12),
('in_progress', 'قيد التنفيذ', 'bg-charity-primary text-white border-charity-primary', 13),
('pending_final_report', 'بانتظار التقرير الختامي', 'bg-charity-medium text-white border-charity-medium', 14),
('pending_closure', 'بانتظار الإغلاق', 'bg-charity-medium text-white border-charity-medium', 15),
('closed', 'مغلق', 'bg-slate-600 text-white border-slate-600', 16),
('cancelled', 'ملغي', 'bg-red-600 text-white border-red-600', 17)
ON CONFLICT (status_key) DO UPDATE SET
  arabic_label = EXCLUDED.arabic_label,
  color_class = EXCLUDED.color_class,
  display_order = EXCLUDED.display_order;

-- إنشاء index لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_status_translations_key ON status_translations(status_key);