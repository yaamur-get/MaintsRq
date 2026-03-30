ALTER TABLE expert_pricing
ADD COLUMN request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
ADD COLUMN external_report_item_id TEXT,
ADD COLUMN external_report_issue_id TEXT,
ADD COLUMN item_main_name TEXT,
ADD COLUMN item_sub_name TEXT,
ADD COLUMN item_specifications TEXT,
ADD COLUMN item_unit TEXT,
ADD COLUMN quantity NUMERIC(10,2),
ADD COLUMN unit_price NUMERIC(10,2);

UPDATE expert_pricing ep
SET request_id = ii.request_id,
    item_main_name = ii.main_item,
    item_sub_name = ii.sub_item,
    item_specifications = ii.specifications,
    unit_price = ep.estimated_price,
    quantity = 1
FROM inspection_items ii
WHERE ep.inspection_item_id = ii.id;

ALTER TABLE expert_pricing
ALTER COLUMN request_id SET NOT NULL,
ALTER COLUMN inspection_item_id DROP NOT NULL;

ALTER TABLE expert_pricing
DROP CONSTRAINT IF EXISTS expert_pricing_inspection_item_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS expert_pricing_request_external_item_unique
ON expert_pricing (request_id, external_report_item_id)
WHERE external_report_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS expert_pricing_inspection_item_id_unique
ON expert_pricing (inspection_item_id)
WHERE inspection_item_id IS NOT NULL;

ALTER TABLE contractor_bids
ADD COLUMN request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
ADD COLUMN external_report_item_id TEXT,
ADD COLUMN item_main_name TEXT,
ADD COLUMN item_sub_name TEXT,
ADD COLUMN quantity NUMERIC(10,2);

UPDATE contractor_bids cb
SET request_id = ii.request_id,
    item_main_name = ii.main_item,
    item_sub_name = ii.sub_item,
    quantity = 1
FROM inspection_items ii
WHERE cb.inspection_item_id = ii.id;

ALTER TABLE contractor_bids
ALTER COLUMN request_id SET NOT NULL,
ALTER COLUMN inspection_item_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS contractor_bids_request_id_idx
ON contractor_bids (request_id);

CREATE INDEX IF NOT EXISTS contractor_bids_request_external_item_idx
ON contractor_bids (request_id, external_report_item_id)
WHERE external_report_item_id IS NOT NULL;