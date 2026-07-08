-- Tạo bảng liên kết khóa học và học sinh
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(course_id, student_id)
);

-- Kích hoạt Row-Level Security (RLS)
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- Chính sách 1: Xem danh sách ghi danh
-- Giáo viên sở hữu khóa học, Admin, và bản thân Học sinh đó được quyền xem
DROP POLICY IF EXISTS "Allow users to view course enrollments" ON course_enrollments;
CREATE POLICY "Allow users to view course enrollments" ON course_enrollments
    FOR SELECT TO authenticated
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND (
                courses.teacher_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'superuser'
                )
            )
        )
    );

-- Chính sách 2: Giáo viên sở hữu khóa học và Admin được toàn quyền quản lý (Thêm/Xóa học sinh)
DROP POLICY IF EXISTS "Allow teacher and superuser to manage enrollments" ON course_enrollments;
CREATE POLICY "Allow teacher and superuser to manage enrollments" ON course_enrollments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND (
                courses.teacher_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'superuser'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND (
                courses.teacher_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'superuser'
                )
            )
        )
    );


-- Cập nhật hàm start_exam_attempt để kiểm tra xem học sinh có được ghi danh vào khóa học hay không
CREATE OR REPLACE FUNCTION start_exam_attempt(
    p_exam_id TEXT,
    p_student_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_attempt_id UUID;
    v_credit_cost INT;
    v_current_credits INT;
    v_is_premium BOOLEAN;
    v_course_id UUID;
    v_is_enrolled BOOLEAN;
BEGIN
    -- 1. Khóa dòng dữ liệu profile của học sinh ngay từ đầu bằng FOR UPDATE
    SELECT credits, is_premium INTO v_current_credits, v_is_premium
    FROM profiles
    WHERE id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hồ sơ học sinh không tồn tại.';
    END IF;

    -- 2. Kiểm tra xem học sinh đã có lượt làm bài nào ĐANG IN-PROGRESS (chưa nộp) của đề thi này chưa
    SELECT id INTO v_attempt_id
    FROM exam_attempts
    WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'in_progress'
    LIMIT 1;

    -- Nếu đã có lượt đang làm dở, trả về luôn để tiếp tục làm bài
    IF v_attempt_id IS NOT NULL THEN
        RETURN v_attempt_id;
    END IF;

    -- 3. Kiểm tra phân quyền khóa học (Nếu đề thi thuộc về một khóa học, học sinh bắt buộc phải được Giáo viên ghi danh)
    SELECT course_id, credit_cost INTO v_course_id, v_credit_cost
    FROM exams
    WHERE id = p_exam_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Đề thi không tồn tại.';
    END IF;

    IF v_course_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM course_enrollments
            WHERE course_id = v_course_id AND student_id = p_student_id
        ) INTO v_is_enrolled;

        IF NOT v_is_enrolled THEN
            RAISE EXCEPTION 'Bạn không có quyền tham gia đề thi này vì chưa được giáo viên ghi danh vào khóa học tương ứng.';
        END IF;
    END IF;

    -- 4. Thực hiện trừ xu nếu học sinh KHÔNG phải là VIP (is_premium = FALSE) và đề thi có phí (> 0 xu)
    IF NOT v_is_premium AND v_credit_cost > 0 THEN
        IF v_current_credits < v_credit_cost THEN
            RAISE EXCEPTION 'Bạn không đủ xu để làm đề thi này. Đề thi yêu cầu % xu, số dư của bạn là % xu. Hãy liên hệ Giáo viên để gia hạn thêm xu hoặc nâng cấp tài khoản VIP Vô Hạn!', v_credit_cost, v_current_credits;
        END IF;

        -- Trừ xu học sinh
        UPDATE profiles
        SET credits = credits - v_credit_cost
        WHERE id = p_student_id;

        -- Ghi nhật ký giao dịch tiêu dùng xu
        INSERT INTO credit_transactions (student_id, amount, type, exam_id, description)
        VALUES (
            p_student_id, 
            -v_credit_cost, 
            'spend', 
            p_exam_id, 
            'Làm đề thi: ' || (SELECT title FROM exams WHERE id = p_exam_id)
        );
    END IF;

    -- 5. Khởi tạo bản ghi lượt làm bài thi mới
    INSERT INTO exam_attempts (
        id,
        exam_id,
        student_id,
        started_at,
        status,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        p_exam_id,
        p_student_id,
        NOW(),
        'in_progress',
        NOW()
    )
    RETURNING id INTO v_attempt_id;

    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
