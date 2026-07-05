-- 1. Hàm start_exam_attempt: Khởi tạo lượt làm bài mới (trạng thái in_progress) nếu chưa có
CREATE OR REPLACE FUNCTION start_exam_attempt(
    p_exam_id TEXT,
    p_student_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_attempt_id UUID;
BEGIN
    -- Kiểm tra xem đã có lượt làm bài nào đang làm (in_progress) hay chưa
    SELECT id INTO v_attempt_id
    FROM exam_attempts
    WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'in_progress'
    LIMIT 1;

    -- Nếu chưa có, tạo mới
    IF v_attempt_id IS NULL THEN
        INSERT INTO exam_attempts (exam_id, student_id, started_at, status)
        VALUES (p_exam_id, p_student_id, now(), 'in_progress')
        RETURNING id INTO v_attempt_id;
    END IF;

    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hàm submit_and_score_exam: Nộp bài, tính điểm tự động và lưu kết quả
CREATE OR REPLACE FUNCTION submit_and_score_exam(
    p_exam_id TEXT,
    p_student_id UUID,
    p_answers JSONB -- Định dạng: [{"question_id": "...", "selected_answer": ...}]
)
RETURNS UUID AS $$
DECLARE
    v_attempt_id UUID;
    v_total_questions INT4;
    v_correct_count INT4 := 0;
    v_total_score NUMERIC := 0;
    v_question_record RECORD;
    v_student_answer JSONB;
    v_correct_answer JSONB;
    v_q_type TEXT;
    v_q_score NUMERIC;
    v_is_correct BOOLEAN;
    v_graded_answers JSONB := '[]'::JSONB;
    v_graded_item JSONB;
BEGIN
    -- Kiểm tra xem có lượt làm bài đang thực hiện không
    SELECT id INTO v_attempt_id
    FROM exam_attempts
    WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'in_progress'
    LIMIT 1;

    -- Nếu không có, tạo mới và lưu luôn
    IF v_attempt_id IS NULL THEN
        INSERT INTO exam_attempts (exam_id, student_id, started_at, status)
        VALUES (p_exam_id, p_student_id, now(), 'in_progress')
        RETURNING id INTO v_attempt_id;
    END IF;

    -- Đếm tổng số câu hỏi trong đề thi
    SELECT COUNT(*) INTO v_total_questions
    FROM exam_questions
    WHERE exam_id = p_exam_id;

    -- Duyệt qua từng câu hỏi của đề thi để chấm điểm
    FOR v_question_record IN 
        SELECT eq.question_id, eq.score, q.question_type, q.metadata
        FROM exam_questions eq
        JOIN questions q ON eq.question_id = q.id
        WHERE eq.exam_id = p_exam_id
    LOOP
        -- Trích xuất câu trả lời của học sinh từ payload gửi lên
        SELECT elem->'selected_answer' INTO v_student_answer
        FROM jsonb_array_elements(p_answers) elem
        WHERE elem->>'question_id' = v_question_record.question_id;

        v_is_correct := FALSE;
        v_q_type := v_question_record.question_type;
        v_q_score := COALESCE(v_question_record.score, 0);
        v_correct_answer := v_question_record.metadata->'correct_answer';

        -- So khớp đáp án dựa trên loại câu hỏi
        IF v_student_answer IS NOT NULL AND jsonb_typeof(v_student_answer) != 'null' THEN
            IF v_q_type = 'trac_nghiem' THEN
                -- Trắc nghiệm một lựa chọn
                IF v_student_answer = v_correct_answer THEN
                    v_is_correct := TRUE;
                END IF;
            ELSIF v_q_type = 'dung_sai' THEN
                -- Trắc nghiệm Đúng / Sai (So sánh 2 object)
                IF v_student_answer = v_correct_answer THEN
                    v_is_correct := TRUE;
                END IF;
            ELSIF v_q_type = 'tra_loi_ngan' THEN
                -- Trả lời ngắn (So sánh chuỗi không phân biệt hoa thường, cắt khoảng trắng)
                IF jsonb_typeof(v_student_answer) = 'string' AND jsonb_typeof(v_correct_answer) = 'string' THEN
                    IF trim(lower(v_student_answer#>>'{}')) = trim(lower(v_correct_answer#>>'{}')) THEN
                        v_is_correct := TRUE;
                    END IF;
                ELSE
                    -- Fallback so sánh chuỗi thô
                    IF trim(lower(v_student_answer#>>'{}')) = trim(lower(v_correct_answer#>>'{}')) THEN
                        v_is_correct := TRUE;
                    END IF;
                END IF;
            ELSIF v_q_type = 'noi_cau' THEN
                -- Nối câu (So sánh cặp kết nối dưới dạng object)
                IF v_student_answer = v_correct_answer THEN
                    v_is_correct := TRUE;
                END IF;
            END IF;
        END IF;

        IF v_is_correct THEN
            v_correct_count := v_correct_count + 1;
            v_total_score := v_total_score + v_q_score;
        END IF;

        -- Lưu lại chi tiết bài làm của câu hỏi này
        v_graded_item := jsonb_build_object(
            'question_id', v_question_record.question_id,
            'selected_answer', v_student_answer,
            'correct_answer', v_correct_answer,
            'is_correct', v_is_correct,
            'score', CASE WHEN v_is_correct THEN v_q_score ELSE 0 END
        );
        v_graded_answers := v_graded_answers || v_graded_item;
    END LOOP;

    -- Cập nhật lượt làm bài thành hoàn thành, lưu kết quả chấm điểm
    UPDATE exam_attempts
    SET completed_at = now(),
        score = round(v_total_score, 2),
        correct_answers_count = v_correct_count,
        total_questions_count = v_total_questions,
        status = 'completed',
        answers = v_graded_answers
    WHERE id = v_attempt_id;

    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
