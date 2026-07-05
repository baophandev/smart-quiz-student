-- MIGRATION: HỆ THỐNG XU DÙNG THỬ & TÀI KHOẢN VÔ HẠN (VIP)
-- Copy toàn bộ đoạn script SQL này dán vào Supabase SQL Editor và chạy (Run).

-- 1. Bổ sung các trường vào bảng profiles (Học sinh)
-- Mặc định cấp 30 xu dùng thử cho mỗi tài khoản học sinh mới.
-- Trường is_premium xác định xem tài khoản có được nâng cấp VIP Vô Hạn xu hay không.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INT4 NOT NULL DEFAULT 30 CONSTRAINT check_credits_non_negative CHECK (credits >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Bổ sung các trường vào bảng exams (Đề thi)
-- Mặc định chi phí làm bài của mỗi đề thi là 5 xu.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS credit_cost INT4 NOT NULL DEFAULT 5 CONSTRAINT check_cost_non_negative CHECK (credit_cost >= 0);

-- 3. Tạo bảng credit_transactions để ghi nhật ký sử dụng xu
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INT4 NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('spend', 'topup', 'bonus', 'refund', 'admin_grant')),
    exam_id TEXT REFERENCES exams(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bật Row Level Security (RLS) cho bảng giao dịch
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Tạo chính sách bảo mật cho bảng giao dịch
DROP POLICY IF EXISTS "Học sinh chỉ xem giao dịch của mình" ON credit_transactions;
CREATE POLICY "Học sinh chỉ xem giao dịch của mình" ON credit_transactions
    FOR SELECT TO authenticated USING (auth.uid() = student_id);

-- 6. Tối ưu lại hàm start_exam_attempt để tự động kiểm tra và khấu trừ Credit (Trừ phi là tài khoản VIP)
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
BEGIN
    -- 1. Khóa dòng dữ liệu profile của học sinh ngay từ đầu bằng FOR UPDATE
    -- Việc này tuần tự hóa (serialize) các yêu cầu đồng thời từ cùng một học sinh,
    -- giải quyết triệt để race condition khi useEffect gọi RPC song song (Strict Mode của React).
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

    -- Nếu đã có lượt đang làm dở, trả về luôn để tiếp tục làm bài (chống mất trạng thái khi tải lại trang, không trừ thêm xu)
    IF v_attempt_id IS NOT NULL THEN
        RETURN v_attempt_id;
    END IF;

    -- 3. Lấy thông tin chi phí của đề thi
    SELECT credit_cost INTO v_credit_cost
    FROM exams
    WHERE id = p_exam_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Đề thi không tồn tại.';
    END IF;

    -- 4. Thực hiện trừ xu nếu học sinh KHÔNG phải là VIP (is_premium = FALSE) và đề thi có phí (> 0 xu)
    IF NOT v_is_premium AND v_credit_cost > 0 THEN
        IF v_current_credits < v_credit_cost THEN
            RAISE EXCEPTION 'Bạn không đủ xu để làm đề thi này. Đề thi yêu cầu % xu, số dư của bạn là % xu. Hãy liên hệ Giáo viên để gia hạn thêm xu hoặc nâng cấp tài khoản Vô Hạn!', v_credit_cost, v_current_credits;
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

-- 7. Cấp quyền cho Giáo viên và Super User được phép cập nhật bảng profiles (để thay đổi credits/is_premium cho học sinh)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow staff to update profiles" ON profiles;
CREATE POLICY "Allow staff to update profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('teacher', 'superuser')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('teacher', 'superuser')
        )
    );

-- 8. Cấp quyền cho Giáo viên và Super User xem toàn bộ giao dịch và tạo mới giao dịch (admin_grant)
DROP POLICY IF EXISTS "Allow staff to view all credit transactions" ON credit_transactions;
CREATE POLICY "Allow staff to view all credit transactions" ON credit_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('teacher', 'superuser')
        )
    );

DROP POLICY IF EXISTS "Allow staff to insert credit transactions" ON credit_transactions;
CREATE POLICY "Allow staff to insert credit transactions" ON credit_transactions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('teacher', 'superuser')
        )
    );

-- 9. Đảm bảo toàn vẹn dữ liệu: Chuyển ràng buộc khóa ngoại của exam_attempts từ ON DELETE CASCADE sang ON DELETE RESTRICT
-- Điều này ngăn cản việc xóa đề thi khi đã có học sinh làm bài (tránh làm mất lịch sử thi & tiêu tốn xu của học sinh).
-- Thay vào đó, giáo viên có thể chuyển trạng thái đề thi sang "Bản nháp" (Draft) để ẩn đi.
ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_exam_id_fkey;
ALTER TABLE exam_attempts 
    ADD CONSTRAINT exam_attempts_exam_id_fkey 
    FOREIGN KEY (exam_id) 
    REFERENCES exams(id) 
    ON DELETE RESTRICT;
