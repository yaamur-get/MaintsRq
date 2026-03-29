-- إضافة الأعمدة الناقصة إلى جدول mosques
ALTER TABLE mosques 
ADD COLUMN IF NOT EXISTS imam_name text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS capacity integer,
ADD COLUMN IF NOT EXISTS latitude numeric(10, 8),
ADD COLUMN IF NOT EXISTS longitude numeric(11, 8),
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- إعادة إنشاء فهارس إذا لزم الأمر
CREATE INDEX IF NOT EXISTS idx_mosques_is_active ON mosques(is_active);