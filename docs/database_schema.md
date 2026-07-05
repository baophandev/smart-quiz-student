# 🗄️ Cấu trúc Cơ sở Dữ liệu (Database Schema)

Tài liệu này mô tả chi tiết các bảng, kiểu dữ liệu, ràng buộc và mối quan hệ trong cơ sở dữ liệu của hệ thống **Smart Quiz App** dựa trên sơ đồ thực thể mối quan hệ (ERD).

---

## 🔑 Ký hiệu Quy ước
*   🔑 **Primary Key**: Khóa chính của bảng.
*   🧬 **Unique**: Giá trị là độc nhất trong cột.
*   ✦ **Non-Nullable**: Trường bắt buộc, không được để trống.
*   ◇ **Nullable**: Trường không bắt buộc, có thể để trống.
*   🔗 **Foreign Key**: Khóa ngoại liên kết tới bảng khác.

---

## 📊 Chi tiết các bảng

### 1. Bảng `profiles`
Lưu trữ thông tin hồ sơ và vai trò của người dùng trong hệ thống (Superadmin, Teacher, Student).

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `uuid` | ✦ | Khóa chính, liên kết ngoại 1-1 tới `auth.users.id` |
| `full_name` | `text` | ✦ | Họ và tên đầy đủ của người dùng |
| `role` | `text` | ✦ | Vai trò người dùng (`superadmin`, `teacher`, `student`) |
| `created_by` 🔗 | `uuid` | ◇ | ID của người tạo tài khoản này, liên kết ngoại tới `profiles.id` |
| `email` | `text` | ✦ | Địa chỉ email người dùng |

---

### 2. Bảng `subjects`
Quản lý danh sách các môn học trong hệ thống.

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `int4` | ✦ (Identity) | Khóa chính, tự động tăng |
| `name` | `text` | ✦ 🧬 | Tên môn học (Độc nhất) |
| `description` | `text` | ◇ | Mô tả chi tiết về môn học |
| `grade_id` 🔗 | `int4` | ◇ | ID khối lớp liên kết, liên kết ngoại tới `grades.id` |
| `created_at` | `timestamptz` | ◇ | Thời gian tạo môn học |

---

### 3. Bảng `lessons`
Quản lý các bài học thuộc một môn học cụ thể.

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `int4` | ✦ (Identity) | Khóa chính, tự động tăng |
| `subject_id` 🔗 | `int4` | ◇ | ID môn học trực thuộc, liên kết ngoại tới `subjects.id` |
| `name` | `text` | ✦ | Tên bài học |
| `created_at` | `timestamptz` | ◇ | Thời gian tạo bài học |

---

### 4. Bảng `questions`
Ngân hàng câu hỏi trắc nghiệm.

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `text` | ✦ | Khóa chính dạng chuỗi định danh |
| `lesson_id` 🔗 | `int4` | ◇ | ID bài học liên kết, liên kết ngoại tới `lessons.id` |
| `question_type` | `text` | ✦ | Loại câu hỏi (ví dụ: trắc nghiệm, điền từ...) |
| `difficulty_level`| `text` | ✦ | Mức độ khó (dễ, trung bình, khó) |
| `content` | `text` | ✦ | Nội dung/đề bài của câu hỏi |
| `metadata` | `jsonb` | ✦ | Dữ liệu cấu trúc mở rộng (đáp án, gợi ý...) |
| `created_at` | `timestamptz` | ◇ | Thời gian tạo câu hỏi |

---

### 5. Bảng `exams`
Danh sách đề thi trắc nghiệm.

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `text` | ✦ | Khóa chính dạng chuỗi định danh |
| `title` | `text` | ✦ | Tiêu đề của đề thi |
| `duration` | `int4` | ✦ | Thời gian làm bài (tính bằng phút hoặc giây) |
| `status` | `text` | ◇ | Trạng thái đề thi (`draft`: bản nháp, `published`: đã xuất bản, mặc định: `draft`) |
| `created_at` | `timestamptz` | ◇ | Thời gian tạo đề thi |

---

### 6. Bảng `exam_questions`
Bảng trung gian thiết lập mối quan hệ nhiều-nhiều (N-N) giữa Đề thi (`exams`) và Câu hỏi (`questions`), xác định thứ tự câu hỏi và điểm số trong đề.

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `exam_id` 🔑 🔗 | `text` | ✦ | Phần khóa chính, liên kết ngoại tới `exams.id` |
| `question_id` 🔑 🔗| `text` | ✦ | Phần khóa chính, liên kết ngoại tới `questions.id` |
| `question_order` | `int4` | ✦ | Thứ tự xuất hiện của câu hỏi trong đề thi đó |
| `score` | `numeric` | ◇ | Điểm số của câu hỏi trong đề thi (ví dụ: 0.2, 0.5) |

---

### 7. Bảng `grades`
Quản lý các khối lớp trong hệ thống (cấu hình trong Database).

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `int4` | ✦ (Identity) | Khóa chính, tự động tăng |
| `name` | `varchar` | ✦ 🧬 | Tên khối lớp (ví dụ: 'Khối 10', 'Khối 11', 'Khối 12') |
| `created_at` | `timestamptz` | ◇ | Thời gian tạo |

### 8. Bảng `exam_attempts`
Lưu trữ lượt làm bài thi trắc nghiệm của học sinh, điểm số, số câu trả lời đúng và chi tiết phương án đã chọn.

| Tên cột | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` 🔑 | `uuid` | ✦ | Khóa chính, tự động tạo ngẫu nhiên |
| `exam_id` 🔗 | `text` | ✦ | ID đề thi học sinh làm, liên kết ngoại tới `exams.id` |
| `student_id` 🔗 | `uuid` | ✦ | ID của học sinh thực hiện, liên kết ngoại tới `profiles.id` |
| `started_at` | `timestamptz` | ✦ | Thời gian bắt đầu làm bài |
| `completed_at` | `timestamptz` | ◇ | Thời gian nộp bài / hoàn thành |
| `score` | `numeric` | ◇ | Tổng điểm số đạt được (ví dụ: 8.5) |
| `correct_answers_count` | `int4` | ◇ | Số câu trả lời đúng |
| `total_questions_count` | `int4` | ◇ | Tổng số câu hỏi của đề thi |
| `status` | `text` | ✦ | Trạng thái (`in_progress`: đang làm, `completed`: đã nộp) |
| `answers` | `jsonb` | ◇ | Danh sách chi tiết các đáp án học sinh đã chọn |
| `created_at` | `timestamptz` | ✦ | Thời gian bản ghi được tạo |

---

## 🔄 Sơ đồ Quan hệ & Liên kết
1. **`profiles` (Người dùng)**:
   * Một `profiles` có thể được tạo bởi một `profiles` khác (`created_by` -> `id`).
   * `id` liên kết 1-1 với `auth.users.id`.
2. **`grades` và `subjects`**:
   * Quan hệ 1-N: Một Khối lớp (`grades`) chứa nhiều Môn học (`subjects`).
3. **`subjects` và `lessons`**:
   * Quan hệ 1-N: Một Môn học (`subjects`) chứa nhiều Bài học (`lessons`).
4. **`lessons` và `questions`**:
   * Quan hệ 1-N: Một Bài học (`lessons`) chứa nhiều Câu hỏi (`questions`).
5. **`exams` và `questions` (thông qua `exam_questions`)**:
   * Quan hệ N-N: Một Đề thi có nhiều Câu hỏi, và một Câu hỏi có thể nằm trong nhiều Đề thi.
6. **`exam_attempts` (Lượt làm bài)**:
   * Quan hệ N-1 với `exams`: Một đề thi có thể có nhiều lượt làm bài từ nhiều học sinh khác nhau.
   * Quan hệ N-1 với `profiles`: Một học sinh có thể thực hiện nhiều lượt làm bài thi.

---

## ⚙️ Các Hàm Cơ sở Dữ liệu (RPC Functions)

Hệ thống sử dụng các Hàm PostgreSQL (RPC) dưới đây để tối ưu hóa xử lý nghiệp vụ làm bài và chấm điểm ở phía máy chủ (database level) thay vì xử lý ở client:

### 1. Hàm `start_exam_attempt`
Khởi tạo hoặc trả về một lượt làm bài thi đang diễn ra (`in_progress`) của học sinh đối với một đề thi cụ thể.

*   **Tên hàm trong RPC**: `start_exam_attempt`
*   **Tham số đầu vào**:
    *   `p_exam_id` (`text`): ID của đề thi.
    *   `p_student_id` (`uuid`): ID của học sinh làm bài (liên kết tới `profiles.id`).
*   **Kiểu dữ liệu trả về**: `uuid` (ID của lượt làm bài `exam_attempts.id`).
*   **Nguyên lý hoạt động**: 
    1. Kiểm tra xem học sinh đã có lượt làm bài nào có trạng thái `in_progress` cho đề thi này chưa.
    2. Nếu đã có, trả về ID của lượt làm bài hiện tại để tiếp tục làm bài (chống mất trạng thái khi tải lại trang).
    3. Nếu chưa có, tạo mới một bản ghi trong `exam_attempts` với trạng thái `in_progress` và trả về ID của bản ghi mới.

### 2. Hàm `submit_and_score_exam`
Nộp bài thi, tự động tính điểm số dựa trên đáp án học sinh chọn so với đáp án đúng, và cập nhật trạng thái lượt làm bài thành hoàn thành (`completed`).

*   **Tên hàm trong RPC**: `submit_and_score_exam`
*   **Tham số đầu vào**:
    *   `p_exam_id` (`text`): ID của đề thi.
    *   `p_student_id` (`uuid`): ID của học sinh (liên kết tới `profiles.id`).
    *   `p_answers` (`jsonb`): Danh sách câu trả lời của học sinh dưới dạng mảng JSON (ví dụ: `[{"question_id": "q1", "selected_answer": "A"}, ...]`).
*   **Kiểu dữ liệu trả về**: `uuid` (ID của lượt làm bài `exam_attempts.id`).
*   **Nguyên lý hoạt động**:
    1. Lấy thông tin lượt làm bài `in_progress` hiện tại. Nếu không có, tạo mới.
    2. Đếm tổng số câu hỏi trong đề thi.
    3. Duyệt qua từng câu hỏi trong đề thi:
        * So sánh câu trả lời của học sinh (`selected_answer`) với đáp án đúng (`correct_answer` trong metadata câu hỏi).
        * Hỗ trợ chấm điểm cho 4 loại câu hỏi: Trắc nghiệm (`trac_nghiem`), Đúng/Sai (`dung_sai`), Trả lời ngắn (`tra_loi_ngan` - so sánh không phân biệt hoa thường và khoảng trắng), Nối câu (`noi_cau`).
        * Tính điểm cộng dồn dựa trên cột `score` trong bảng `exam_questions`.
    4. Cập nhật bản ghi `exam_attempts`: trạng thái đổi thành `completed`, lưu lại `score`, số câu đúng (`correct_answers_count`), tổng số câu (`total_questions_count`), thời gian nộp bài (`completed_at`), và lưu chi tiết quá trình chấm từng câu vào cột `answers`.


