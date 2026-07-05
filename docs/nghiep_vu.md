# HỒ SƠ NGHIỆP VỤ LÕI: LUỒNG TẠO ĐỀ THI TỪ NGÂN HÀNG CÂU HỎI

## 1. Mục tiêu cốt lõi (Core Objective)
Xây dựng tính năng cho phép Giáo viên tạo Đề thi (Exam) từ Ngân hàng câu hỏi (Questions Bank) dựa trên một "Ma trận đề" (Exam Matrix). Hệ thống phải đảm bảo hiệu năng cao, không tải quá tải bộ nhớ trình duyệt và chống gian lận tuyệt đối.

## 2. Các Bảng Dữ Liệu Liên Quan (Database Schema Focus)
- `questions`: Nơi chứa câu hỏi gốc. Các trường quan trọng để lọc: `lesson_id` (thuộc bài học nào), `difficulty_level` (nhận biết, thông hiểu, vận dụng, vận dụng cao).
- `exams`: Lưu thông tin chung của đề thi (id, title, duration).
- `exam_questions`: Bảng nối (n-n) lưu chính xác những câu hỏi nào đã được bốc vào đề thi nào, kèm theo thứ tự gốc (exam_id, question_id, question_order).

## 3. Kiến trúc xử lý: Phân chia trách nhiệm (Frontend vs Backend)

### Bước 1: Frontend - Thiết lập Ma trận đề thi (UI/UX)
- **Giao diện Giáo viên:** Màn hình tạo đề thi không hiển thị danh sách hàng ngàn câu hỏi để chọn tay (tránh lag). Thay vào đó, sử dụng UI "Ma trận đề" (Matrix Builder).
- **Cấu trúc Ma trận:** Giáo viên cấu hình số lượng câu hỏi theo từng bài học và độ khó. 
  *Ví dụ: Bài học 1 (5 câu nhận biết, 2 câu thông hiểu); Bài học 2 (3 câu vận dụng).*
- **Nhiệm vụ của Agent:** Xây dựng Form React thu thập thông tin này và đóng gói thành một mảng JSON gọn nhẹ, ví dụ: 
  `matrix = [{ lesson_id: 1, difficulty: 'nhan_biet', limit: 5 }, ...]`

### Bước 2: Backend (Supabase RPC) - Bốc ngẫu nhiên & Lưu trữ
- **Tuyệt đối không tải toàn bộ câu hỏi về Frontend để dùng `Math.random()`.**
- Frontend gửi cục `matrix` cùng thông tin đề thi (`title`, `duration`) gọi xuống một hàm RPC của Supabase (ví dụ: `generate_exam_from_matrix`).
- **Logic nội bộ của RPC:** 1. Tạo một record mới trong bảng `exams`.
  2. Dùng vòng lặp duyệt qua cái `matrix`, sử dụng câu lệnh SQL `ORDER BY RANDOM() LIMIT X` để bốc chính xác số lượng câu hỏi từ bảng `questions`.
  3. Lưu hàng loạt các ID câu hỏi vừa bốc được vào bảng `exam_questions`.
  4. Trả về cho Frontend `exam_id` vừa tạo thành công.

### Bước 3: Frontend - Trải nghiệm Làm bài thi của Học sinh (Thick Client)
- Khi Học sinh mở đề thi, Frontend gọi API lấy danh sách câu hỏi từ `exam_questions` (Join với bảng `questions`).
- **Nhiệm vụ của Agent:** 1. Dùng JavaScript xáo trộn ngẫu nhiên (Shuffle) thứ tự hiển thị của các đáp án (A, B, C, D) từ cột `metadata` để 2 học sinh ngồi cạnh nhau không giống nhau.
  2. Tạo bộ đếm ngược thời gian (Countdown Timer) lưu vào LocalStorage để chống mất trạng thái khi F5 tải lại trang.

### Bước 4: Backend - Nộp bài và Chấm điểm (Anti-Cheat)
- **Tuyệt đối không chấm điểm tại Frontend.**
- Khi hết giờ hoặc bấm nộp bài, Frontend chỉ gửi một payload cực nhẹ chứa lựa chọn của học sinh: 
  `[{ question_id: "...", selected_answer: "A" }, ...]`
- Agent phải gọi một hàm RPC (ví dụ: `submit_and_score_exam`). Backend sẽ tự đối chiếu mảng này với đáp án đúng đang được giấu kín, tính ra điểm số cuối cùng và lưu vào bảng kết quả.

## 4. Yêu cầu Code dành cho Agent
- Xây dựng component `ExamBuilder.tsx` (Dành cho Giáo viên) với các input động (Dynamic Forms) cho phép thêm/bớt các dòng trong Ma trận đề thi.
- Xây dựng component `ExamTaker.tsx` (Dành cho Học sinh) có giao diện thi trắc nghiệm chia cột (Bên trái: Câu hỏi; Bên phải: Lưới điều hướng câu hỏi và Đồng hồ).
- Viết sẵn các interface TypeScript cho `ExamMatrixRule`, `ExamPayload`, và `SubmitPayload`.