-- Store funding-channel specific inputs while keeping one unified completion flow
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS funding_channel_data jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS funding_completion_phrase text;

COMMENT ON COLUMN public.requests.funding_channel_data IS
'Per-channel funding payload (direct donor proof, store URL, ehsan checklist)';

COMMENT ON COLUMN public.requests.funding_completion_phrase IS
'Manual confirmation phrase entered by project manager before marking funding complete';
