-- MIGRATION: BẮT BUỘC LIÊN KẾT ĐỀ THI VỚI KHÓA HỌC & BẢO MẬT ĐỀ THI THEO GIÁO VIÊN
-- Sao chép toàn bộ đoạn script SQL này dán vào Supabase SQL Editor và chạy (Run).

-- 1. Xóa các liên kết câu hỏi của đề thi không có khóa học
DELETE FROM exam_questions WHERE exam_id IN (SELECT id FROM exams WHERE course_id IS NULL);

-- 2. Xóa các lượt làm bài của đề thi không có khóa học
DELETE FROM exam_attempts WHERE exam_id IN (SELECT id FROM exams WHERE course_id IS NULL);

-- 3. Xóa các đề thi không có khóa học để đảm bảo tính toàn vẹn dữ liệu
DELETE FROM exams WHERE course_id IS NULL;

-- 4. Cập nhật trường course_id thành NOT NULL
ALTER TABLE exams ALTER COLUMN course_id SET NOT NULL;

-- 3. Kích hoạt Row Level Security (RLS) cho bảng exams
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- 4. Xóa các chính sách cũ liên quan tới exams nếu có
DROP POLICY IF EXISTS "Exams select policy" ON exams;
DROP POLICY IF EXISTS "Allow teacher and superuser to insert exams" ON exams;
DROP POLICY IF EXISTS "Allow teacher and superuser to update exams" ON exams;
DROP POLICY IF EXISTS "Allow teacher and superuser to delete exams" ON exams;
DROP POLICY IF EXISTS "Exams insert policy" ON exams;
DROP POLICY IF EXISTS "Exams update policy" ON exams;
DROP POLICY IF EXISTS "Exams delete policy" ON exams;

-- 5. Tạo chính sách SELECT (Xem đề thi)
-- Giáo viên chỉ được xem các đề thi thuộc khóa học do mình tạo
-- Học sinh chỉ được xem các đề thi thuộc khóa học mà họ được ghi danh (enroll)
-- Super User / Admin được xem tất cả đề thi
CREATE POLICY "Exams select policy" ON exams
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = exams.course_id
            AND courses.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'superuser'
        )
        OR EXISTS (
            SELECT 1 FROM course_enrollments
            WHERE course_enrollments.course_id = exams.course_id
            AND course_enrollments.student_id = auth.uid()
        )
    );

-- 6. Tạo chính sách INSERT (Thêm đề thi mới)
-- Giáo viên chỉ được thêm đề thi vào các khóa học do họ sở hữu
-- Super User / Admin được thêm vào bất kỳ khóa học nào
CREATE POLICY "Exams insert policy" ON exams
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = exams.course_id
            AND courses.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'superuser'
        )
    );

-- 7. Tạo chính sách UPDATE (Cập nhật đề thi)
-- Giáo viên chỉ được sửa đề thi thuộc khóa học của họ
-- Super User / Admin được sửa bất kỳ
CREATE POLICY "Exams update policy" ON exams
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = exams.course_id
            AND courses.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'superuser'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = exams.course_id
            AND courses.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'superuser'
        )
    );

-- 8. Tạo chính sách DELETE (Xóa đề thi)
-- Giáo viên chỉ được xóa đề thi thuộc khóa học của họ
-- Super User / Admin được xóa bất kỳ
CREATE POLICY "Exams delete policy" ON exams
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = exams.course_id
            AND courses.teacher_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'superuser'
        )
    );
