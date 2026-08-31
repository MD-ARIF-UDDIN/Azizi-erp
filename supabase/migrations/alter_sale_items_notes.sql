-- Add notes column to sale_items table for item-specific notes / references
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS notes text;
