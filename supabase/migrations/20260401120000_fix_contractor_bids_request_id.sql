-- إصلاح contractor_bids: إضافة الأعمدة المفقودة وتعبئة request_id

-- 1. إضافة الأعمدة إذا لم تكن موجودة
ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES requests(id) ON DELETE CASCADE;

ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS external_report_item_id TEXT;

ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS item_main_name TEXT;

ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS item_sub_name TEXT;

ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2);

-- 2. تعبئة request_id من inspection_items (للـ bids المرتبطة بـ inspection_item_id)
UPDATE contractor_bids cb
SET request_id = ii.request_id
FROM inspection_items ii
WHERE cb.inspection_item_id = ii.id
  AND cb.request_id IS NULL;

-- 3. تعبئة request_id من expert_pricing (للـ bids المرتبطة بـ external_report_item_id)
UPDATE contractor_bids cb
SET request_id = ep.request_id
FROM expert_pricing ep
WHERE cb.external_report_item_id = ep.external_report_item_id
  AND cb.request_id IS NULL
  AND ep.request_id IS NOT NULL;

-- 4. إنشاء index لتسريع الاستعلامات
CREATE INDEX IF NOT EXISTS contractor_bids_request_id_idx
ON contractor_bids (request_id);

CREATE INDEX IF NOT EXISTS contractor_bids_request_external_item_idx
ON contractor_bids (request_id, external_report_item_id)
WHERE external_report_item_id IS NOT NULL;
