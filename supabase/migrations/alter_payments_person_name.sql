-- Add person_name and sale_item_id to payments table to track member/person payment allocation
ALTER TABLE payments ADD COLUMN IF NOT EXISTS person_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sale_item_id UUID;
