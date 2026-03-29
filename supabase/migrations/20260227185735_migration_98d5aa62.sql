-- الخطوة 2: إضافة قيد UNIQUE على inspection_item_id
-- هذا يضمن أن كل بند معاينة له تسعيرة واحدة فقط
ALTER TABLE expert_pricing
ADD CONSTRAINT expert_pricing_inspection_item_id_unique 
UNIQUE (inspection_item_id);