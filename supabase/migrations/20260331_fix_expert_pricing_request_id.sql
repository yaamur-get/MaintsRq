-- إصلاح جدول expert_pricing - إضافة العمود request_id المفقود
-- هذا الملف يضيف العمود request_id إلى جدول expert_pricing

-- التحقق من وجود العمود وإضافته إذا كان مفقوداً
ALTER TABLE expert_pricing
ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES requests(id) ON DELETE CASCADE;

-- إذا كانت هناك صفوف قديمة، جرب ملئها من inspection_items
UPDATE expert_pricing ep
SET request_id = ii.request_id
FROM inspection_items ii
WHERE ep.inspection_item_id = ii.id 
  AND ep.request_id IS NULL;

-- جعل العمود مطلوباً بعد ملء البيانات (اختياري - فقط إذا كنت متأكداً من البيانات)
-- ALTER TABLE expert_pricing
-- ALTER COLUMN request_id SET NOT NULL;

-- إضافة الأعمدة الأخرى المفقودة
ALTER TABLE expert_pricing
ADD COLUMN IF NOT EXISTS external_report_item_id TEXT,
ADD COLUMN IF NOT EXISTS external_report_issue_id TEXT,
ADD COLUMN IF NOT EXISTS item_main_name TEXT,
ADD COLUMN IF NOT EXISTS item_sub_name TEXT,
ADD COLUMN IF NOT EXISTS item_specifications TEXT,
ADD COLUMN IF NOT EXISTS item_unit TEXT,
ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

-- إنشاء index فريد للبيانات الخارجية (إذا لم يكن موجوداً)
CREATE UNIQUE INDEX IF NOT EXISTS expert_pricing_request_external_item_unique
ON expert_pricing (request_id, external_report_item_id)
WHERE external_report_item_id IS NOT NULL;
