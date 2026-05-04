-- Per-step sequence configuration: which template + delay for each step.
-- Step 0 = cold email (delay_days ignored), step 1+ = follow-ups.

CREATE TABLE sequence_steps (
  step integer PRIMARY KEY,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  delay_days integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT step_range CHECK (step >= 0 AND step <= 10)
);

-- Insert default 3 steps (cold email + 2 follow-ups)
INSERT INTO sequence_steps (step, template_id, delay_days, is_active) VALUES
  (0, NULL, 0, true),
  (1, NULL, 5, true),
  (2, NULL, 7, true);
