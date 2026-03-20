
-- Add admission_no column to students
ALTER TABLE public.students ADD COLUMN admission_no text UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_students_admission_phone ON public.students (admission_no, parent_phone);
