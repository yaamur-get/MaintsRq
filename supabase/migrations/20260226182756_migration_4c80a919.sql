-- إضافة الأعمدة الناقصة للمقاولين
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS specialization TEXT;

-- الآن يمكننا إضافة البيانات الأولية
INSERT INTO contractors (name, phone, email, specialization, is_active) VALUES
  ('مؤسسة الإتقان للمقاولات', '0501234567', 'itqan@example.com', 'صيانة عامة', true),
  ('شركة الأمانة للكهرباء', '0507654321', 'amana@example.com', 'كهربائية', true),
  ('مؤسسة البناء الحديث', '0509876543', 'modern@example.com', 'ترميمات', true)
ON CONFLICT DO NOTHING;