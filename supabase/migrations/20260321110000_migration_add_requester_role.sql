ALTER TABLE requests
ADD COLUMN IF NOT EXISTS requester_role TEXT;

UPDATE requests
SET requester_role = 'mosque_congregation'
WHERE requester_role IS NULL;

ALTER TABLE requests
ALTER COLUMN requester_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'requests_requester_role_check'
  ) THEN
    ALTER TABLE requests
    ADD CONSTRAINT requests_requester_role_check
    CHECK (requester_role IN ('imam', 'muezzin', 'mosque_congregation'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_requester_role ON requests(requester_role);
