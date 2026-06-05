-- Add review_status column to questions and answers tables
-- Also add classroom_id to questions for categorization

ALTER TABLE questions ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id);

ALTER TABLE answers ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending';

-- shared_notes already has 'status' column which serves the same purpose
-- (status values: 'pending', 'approved', 'rejected' or similar)
