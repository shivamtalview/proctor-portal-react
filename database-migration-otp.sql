-- Add OTP and form link tracking fields to proctors table
ALTER TABLE proctors 
ADD COLUMN IF NOT EXISTS form_link_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS form_link_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS form_otp VARCHAR(6),
ADD COLUMN IF NOT EXISTS form_otp_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS form_otp_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS form_access_count INTEGER DEFAULT 0;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_proctors_form_link_token ON proctors(form_link_token) WHERE form_link_token IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN proctors.form_link_sent_at IS 'When the form link email was sent';
COMMENT ON COLUMN proctors.form_link_expires_at IS 'When the form link expires (typically 14 days from sent date)';
COMMENT ON COLUMN proctors.form_otp IS 'Current OTP for form access (6 digits)';
COMMENT ON COLUMN proctors.form_otp_expires_at IS 'When the OTP expires (typically 10 minutes from generation)';
COMMENT ON COLUMN proctors.form_otp_attempts IS 'Number of failed OTP attempts (for rate limiting)';
COMMENT ON COLUMN proctors.form_access_count IS 'Number of times the form link was accessed';
