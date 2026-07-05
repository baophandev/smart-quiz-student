-- 1. Tạo bảng exam_attempts để lưu trữ lượt làm bài thi của học sinh
CREATE TABLE IF NOT EXISTS exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    score NUMERIC,
    correct_answers_count INT4,
    total_questions_count INT4,
    status TEXT NOT NULL DEFAULT 'in_progress',
    answers JSONB, -- Lưu chi tiết đáp án học sinh chọn: [{"question_id": "...", "selected_answer": "...", "is_correct": true, "score": 0.2}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ràng buộc kiểm tra trạng thái lượt làm bài
    CONSTRAINT exam_attempts_status_check CHECK (status IN ('in_progress', 'completed'))
);

-- 2. Kích hoạt Row Level Security (RLS) cho bảo mật
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

-- 3. Tạo các chính sách bảo mật (RLS Policies)

-- A. Cho phép học sinh xem các lượt làm bài của chính mình
CREATE POLICY "Allow students to view their own attempts" ON exam_attempts
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- B. Cho phép giáo viên và superuser xem tất cả các lượt làm bài để chấm điểm/tổng kết
CREATE POLICY "Allow staff to view all attempts" ON exam_attempts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('teacher', 'superuser')
  )
);

-- C. Cho phép học sinh bắt đầu lượt làm bài mới
CREATE POLICY "Allow students to insert their own attempts" ON exam_attempts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

-- D. Cho phép học sinh cập nhật câu trả lời/nộp bài cho lượt làm bài của mình
CREATE POLICY "Allow students to update their own attempts" ON exam_attempts
FOR UPDATE TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- E. Cho phép giáo viên và superuser xóa lượt làm bài khi cần thiết
CREATE POLICY "Allow staff to delete attempts" ON exam_attempts
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('teacher', 'superuser')
  )
);
