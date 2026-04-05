-- Support specialized contractor bids per item with draft/submitted lifecycle and strict coverage validation.

ALTER TABLE contractor_bids
ADD COLUMN IF NOT EXISTS bid_status TEXT NOT NULL DEFAULT 'offered',
ADD COLUMN IF NOT EXISTS submission_status TEXT NOT NULL DEFAULT 'draft';

UPDATE contractor_bids
SET bid_status = COALESCE(NULLIF(bid_status, ''), 'offered');

UPDATE contractor_bids
SET submission_status = COALESCE(NULLIF(submission_status, ''), 'submitted');

ALTER TABLE contractor_bids
DROP CONSTRAINT IF EXISTS contractor_bids_bid_status_check;

ALTER TABLE contractor_bids
ADD CONSTRAINT contractor_bids_bid_status_check
CHECK (bid_status IN ('offered', 'not_offered'));

ALTER TABLE contractor_bids
DROP CONSTRAINT IF EXISTS contractor_bids_submission_status_check;

ALTER TABLE contractor_bids
ADD CONSTRAINT contractor_bids_submission_status_check
CHECK (submission_status IN ('draft', 'submitted'));

ALTER TABLE contractor_bids
DROP CONSTRAINT IF EXISTS contractor_bids_item_reference_check;

ALTER TABLE contractor_bids
ADD CONSTRAINT contractor_bids_item_reference_check
CHECK (
  (external_report_item_id IS NOT NULL) OR
  (inspection_item_id IS NOT NULL)
);

ALTER TABLE contractor_bids
ALTER COLUMN bid_amount DROP NOT NULL;

ALTER TABLE contractor_bids
DROP CONSTRAINT IF EXISTS contractor_bids_bid_amount_required_when_offered_check;

ALTER TABLE contractor_bids
ADD CONSTRAINT contractor_bids_bid_amount_required_when_offered_check
CHECK (
  (bid_status = 'offered' AND bid_amount IS NOT NULL AND bid_amount > 0)
  OR (bid_status = 'not_offered')
);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_bids_req_contractor_external_unique
ON contractor_bids (request_id, contractor_id, external_report_item_id)
WHERE external_report_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contractor_bids_req_contractor_inspection_unique
ON contractor_bids (request_id, contractor_id, inspection_item_id)
WHERE inspection_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION save_contractor_bids_draft(
  p_request_id UUID,
  p_bids JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_rows INTEGER;
BEGIN
  CREATE TEMP TABLE tmp_contractor_bid_payload ON COMMIT DROP AS
  SELECT
    (row_data->>'contractor_id')::UUID AS contractor_id,
    NULLIF(row_data->>'external_report_item_id', '') AS external_report_item_id,
    NULLIF(row_data->>'inspection_item_id', '')::UUID AS inspection_item_id,
    NULLIF(row_data->>'item_main_name', '') AS item_main_name,
    NULLIF(row_data->>'item_sub_name', '') AS item_sub_name,
    COALESCE(NULLIF(row_data->>'quantity', ''), '1')::NUMERIC AS quantity,
    NULLIF(row_data->>'bid_amount', '')::NUMERIC AS bid_amount,
    NULLIF(row_data->>'notes', '') AS notes,
    NULLIF(row_data->>'bid_document_url', '') AS bid_document_url,
    CASE WHEN COALESCE(row_data->>'bid_status', 'offered') = 'not_offered' THEN 'not_offered' ELSE 'offered' END AS bid_status
  FROM jsonb_array_elements(COALESCE(p_bids, '[]'::JSONB)) row_data;

  SELECT COUNT(*) INTO v_total_rows FROM tmp_contractor_bid_payload;

  IF v_total_rows = 0 THEN
    RAISE EXCEPTION 'لا توجد بيانات عروض لحفظها كمسودة';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_contractor_bid_payload
    WHERE contractor_id IS NULL
      OR (external_report_item_id IS NULL AND inspection_item_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'بيانات غير صالحة: يجب تحديد المقاول والبند لكل صف';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_contractor_bid_payload
    GROUP BY contractor_id, COALESCE(external_report_item_id, inspection_item_id::TEXT)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'لا يمكن تكرار نفس البند لنفس المقاول';
  END IF;

  DELETE FROM contractor_bids cb
  WHERE cb.request_id = p_request_id
    AND cb.contractor_id NOT IN (SELECT DISTINCT contractor_id FROM tmp_contractor_bid_payload);

  INSERT INTO contractor_bids (
    request_id,
    contractor_id,
    external_report_item_id,
    inspection_item_id,
    item_main_name,
    item_sub_name,
    quantity,
    bid_amount,
    notes,
    bid_document_url,
    bid_status,
    submission_status,
    is_selected,
    updated_at
  )
  SELECT
    p_request_id,
    contractor_id,
    external_report_item_id,
    NULL,
    item_main_name,
    item_sub_name,
    quantity,
    CASE WHEN bid_status = 'offered' THEN bid_amount ELSE NULL END,
    notes,
    bid_document_url,
    bid_status,
    'draft',
    false,
    NOW()
  FROM tmp_contractor_bid_payload
  WHERE external_report_item_id IS NOT NULL
  ON CONFLICT (request_id, contractor_id, external_report_item_id)
  WHERE external_report_item_id IS NOT NULL
  DO UPDATE SET
    item_main_name = EXCLUDED.item_main_name,
    item_sub_name = EXCLUDED.item_sub_name,
    quantity = EXCLUDED.quantity,
    bid_amount = EXCLUDED.bid_amount,
    notes = EXCLUDED.notes,
    bid_document_url = EXCLUDED.bid_document_url,
    bid_status = EXCLUDED.bid_status,
    submission_status = 'draft',
    is_selected = false,
    updated_at = NOW();

  INSERT INTO contractor_bids (
    request_id,
    contractor_id,
    external_report_item_id,
    inspection_item_id,
    item_main_name,
    item_sub_name,
    quantity,
    bid_amount,
    notes,
    bid_document_url,
    bid_status,
    submission_status,
    is_selected,
    updated_at
  )
  SELECT
    p_request_id,
    contractor_id,
    NULL,
    inspection_item_id,
    item_main_name,
    item_sub_name,
    quantity,
    CASE WHEN bid_status = 'offered' THEN bid_amount ELSE NULL END,
    notes,
    bid_document_url,
    bid_status,
    'draft',
    false,
    NOW()
  FROM tmp_contractor_bid_payload
  WHERE external_report_item_id IS NULL AND inspection_item_id IS NOT NULL
  ON CONFLICT (request_id, contractor_id, inspection_item_id)
  WHERE inspection_item_id IS NOT NULL
  DO UPDATE SET
    item_main_name = EXCLUDED.item_main_name,
    item_sub_name = EXCLUDED.item_sub_name,
    quantity = EXCLUDED.quantity,
    bid_amount = EXCLUDED.bid_amount,
    notes = EXCLUDED.notes,
    bid_document_url = EXCLUDED.bid_document_url,
    bid_status = EXCLUDED.bid_status,
    submission_status = 'draft',
    is_selected = false,
    updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'mode', 'draft_saved', 'rows', v_total_rows);
END;
$$;

CREATE OR REPLACE FUNCTION submit_contractor_bids_with_coverage(
  p_request_id UUID,
  p_bids JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_missing_items TEXT;
BEGIN
  v_result := save_contractor_bids_draft(p_request_id, p_bids);

  UPDATE contractor_bids
  SET submission_status = 'submitted',
      updated_at = NOW()
  WHERE request_id = p_request_id;

  WITH request_items AS (
    SELECT
      COALESCE(external_report_item_id, inspection_item_id::TEXT) AS item_key,
      COALESCE(item_main_name, 'بند') AS item_main_name,
      COALESCE(item_sub_name, '-') AS item_sub_name
    FROM expert_pricing
    WHERE request_id = p_request_id
  ),
  offered_items AS (
    SELECT DISTINCT COALESCE(external_report_item_id, inspection_item_id::TEXT) AS item_key
    FROM contractor_bids
    WHERE request_id = p_request_id
      AND submission_status = 'submitted'
      AND bid_status = 'offered'
      AND bid_amount IS NOT NULL
      AND bid_amount > 0
  ),
  missing AS (
    SELECT
      ri.item_main_name || ' - ' || ri.item_sub_name AS item_label
    FROM request_items ri
    LEFT JOIN offered_items oi ON oi.item_key = ri.item_key
    WHERE oi.item_key IS NULL
  )
  SELECT string_agg(item_label, '، ') INTO v_missing_items
  FROM missing;

  IF v_missing_items IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن الإرسال: البنود التالية بلا عروض: %', v_missing_items;
  END IF;

  UPDATE requests
  SET current_status = 'pending_contractor_selection',
      updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO request_status_history (request_id, new_status, changed_by, notes)
  VALUES (
    p_request_id,
    'pending_contractor_selection',
    auth.uid(),
    COALESCE(p_notes, 'تم رفع عروض المقاولين - بانتظار اختيار المقاول من مهندس المشروع')
  );

  RETURN jsonb_build_object('ok', true, 'mode', 'submitted', 'request_status', 'pending_contractor_selection');
END;
$$;

GRANT EXECUTE ON FUNCTION save_contractor_bids_draft(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_contractor_bids_with_coverage(UUID, JSONB, TEXT) TO authenticated;
