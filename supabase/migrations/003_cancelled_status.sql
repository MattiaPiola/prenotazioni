-- Allow 'cancelled' as a valid status for recurring_requests
ALTER TABLE recurring_requests DROP CONSTRAINT recurring_requests_status_check;
ALTER TABLE recurring_requests ADD CONSTRAINT recurring_requests_status_check
  CHECK (status IN ('pending', 'approved', 'denied', 'cancelled'));
