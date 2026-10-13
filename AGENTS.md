<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Bảo vệ file bí mật

- Không mở, đọc, tìm kiếm nội dung, trích xuất, hoặc in giá trị từ `.env`, `.env.*` (ngoại trừ `.env.example`), file secrets, license, private key, token hay credential files.
- Nếu cần chẩn đoán cấu hình, chỉ kiểm tra tên biến và trạng thái có/không có giá trị bằng lệnh đã lọc; không hiển thị giá trị bí mật, kể cả trong lỗi, diff hoặc log.
- Nếu người dùng vô tình đính kèm/dán nội dung bí mật hoặc file có khả năng cao chứa nội dung bí mật (ví dụ như .env), Hãy dừng hội thoại ngay trước khi vô tình đọc dữ liệu và khuyên người dùng đổi dữ liệu đã lộ.
- Chỉ dùng `.env.example` với giá trị placeholder để giải thích cấu hình. Không yêu cầu người dùng gửi `.env` thật.

## Quy ước đọc cấu hình môi trường (ai/env_utils.py)

Cả hai pipeline AI — OCR cục bộ (`ai/ocr_module.py`) và AI tạo câu hỏi (`ai/question_generator.py`) — phải đọc cấu hình qua module dùng chung `ai/env_utils.py`. **Không** gọi `os.getenv(...)`/`load_dotenv` rồi tự parse ở nơi khác, vì sẽ tạo ra logic đọc lệch nhau giữa hai pipeline.

- Thứ tự ưu tiên: process env → file `.env` ở gốc dự án → giá trị mặc định trong code.
- Các helper: `read_env_value`, `read_env_bool` (1/true/yes/on, rỗng = unset), `read_env_int` (chặn < 1), `read_env_int_clamped` (kẹp min/max), `read_env_float` (chặn âm).
- Khi thêm biến cấu hình mới:
  - Khai báo mặc định hợp lý ngay tại nơi đọc trong code.
  - Ghi chú biến + dải giá trị vào `.env.example`.
  - Dùng `read_env_bool` cho boolean và `read_env_int_clamped` cho số có dải hợp lệ.
- Danh sách đầy đủ các biến môi trường (`RAPIDOCR_*`, `HF_*`, `AI_GENERATOR_*`) xem trong `README.md` — mục "Quy ước đọc cấu hình dùng chung (ai/env_utils.py)".
