Đây là Trang Web học tập trực tuyến (ứng dụng web học tập trực tuyến) có tích hợp trợ lý AI nhằm hỗ trợ việc tự ôn tập hay tạo câu hỏi cho bài kiểm tra. 

## Link truy cập trực tuyến

- backend: https://learning-app-5hw8.onrender.com

- frontend: https://learning-app-zeta-nine.vercel.app/

- Hướng dẫn ngắn: truy cập backend trước, khi nó hiện dòng tin nhắn "Chào mừng đến với ứng dụng học tập trực tuyến!" thì mới nên truy cập frontend, đảm bảo backend đang chạy khi đang sử dụng trang web.

- Giải thích vì sao phải mở backend trước: Do backend sử dụng render miễn phí nên sẽ vào trạng thái ngủ sau một thời gian frontend không có gửi yêu cầu xử lý và phải mất tầm 1 phút để khởi động lại khi truy cập lại hoặc khi frontend gửi yêu cầu xử lý nếu đang ở trạng thái ngủ.

- Hạn chế của truy cập trực tuyến:

+ AI tạo câu hỏi sử dụng Gemini API. Model có thể xử lý văn bản và ảnh; mức miễn phí có giới hạn quota theo tài khoản/model, và dữ liệu gửi ở free tier có thể được dùng để cải thiện sản phẩm.

+ Việc tạo câu hỏi từ hình ảnh, PDF và video ít văn bản có thể dùng Gemini vision model; nếu học liệu lớn, OCR vẫn có thể chậm hoặc tốn bộ nhớ.

+ OCR có giới hạn kích thước ảnh, số trang PDF và được chạy tuần tự trong mỗi tiến trình để giảm đỉnh sử dụng bộ nhớ trên Render Free. Mặc định, mỗi lượt chỉ OCR tối đa 2 trang PDF; các trang vượt giới hạn được ghi cảnh báo vào log backend.

## Những yêu cầu cho việc cài đặt và sử dụng trong máy (local)

- Cần thiết để chạy trang web (Có thể sử dụng phiên bản cũ hơn hoặc mới hơn nhưng không đảm bảo về khả năng tích hợp của phiên bản):
+ Python phiên bản 3.14.3.
+ Node.js phiên bản 25.8.2.

- Cần cho chức năng tạo người dùng cho quản trị viên và phục hồi mật khẩu:
 SMTP (Dễ nhất là gmail) hoặc sử dụng Resend với một tên miền hợp lệ.

- Cần cho chức năng sử dụng trợ lý AI:
 Tài khoản Google AI Studio (để tạo Gemini API key).

- Cơ sở dữ liệu hỗ trợ:
+ PostgreSQL
+ SQLite (Là file learning_app.db và sẽ tự động tạo nếu không có)

### Soạn thảo bài giảng

Trang `/instructor/document/editor` lưu bản nháp vào bảng riêng `lesson_draft` bằng nội dung JSON của Tiptap. Bản ghi được gắn với giảng viên đăng nhập; tùy chọn `course_id` dành cho liên kết khóa học sau này. Backend tự áp dụng migration khi khởi động.

Để đồng bộ với backend, đặt `NEXT_PUBLIC_USE_MOCK_DATA=false` cho frontend và đăng nhập bằng tài khoản giảng viên thật. Ở chế độ dữ liệu mô phỏng, trang chỉ lưu bản nháp trên trình duyệt hiện tại. Nội dung vẫn có bản dự phòng cục bộ và có kiểm tra phiên bản để tránh ghi đè âm thầm khi nhiều phiên cùng chỉnh sửa.

Trợ lý AI trong trình soạn thảo được gom trong nút **Trợ lý AI** và hỗ trợ viết tiếp từ dàn ý, soạn lại đoạn đang chọn, tạo mục tiêu học tập, hoạt động, câu hỏi ôn tập và sinh nội dung từ tài liệu. Có thể chọn tài liệu thuộc khóa học của giảng viên hoặc tải tệp lên (tối đa 4 MB); tệp tải lên chỉ được xử lý tạm thời, không lưu vào kho. Tài liệu nguồn PDF (OCR tối đa 3 trang), DOCX, PPTX, TXT và Markdown được hỗ trợ. Kết quả luôn được xem trước; chỉ được chèn/thay thế sau khi giảng viên chấp nhận. Nội dung trích xuất được gửi qua backend đã xác thực đến Gemini; thao tác soạn lại chỉ gửi đoạn đang chọn. Đặt `GEMINI_API_KEY` và `GEMINI_LESSON_WRITER_MODEL` ở backend; model được cấu hình độc lập với `GEMINI_TEXT_QUESTION_MODEL`. Có thể giới hạn độ dài phản hồi bằng `GEMINI_LESSON_WRITER_MAX_TOKENS` (256–8192). Không đặt API key Gemini trong biến `NEXT_PUBLIC_*`.

### Tóm tắt tài liệu bằng AI cho sinh viên

Trang xem tài liệu của sinh viên (`/student/courses/[courseId]/document/[documentId]`) tự động hiển thị bản tóm tắt ngắn gọn ngay khi mở tài liệu, gồm đoạn tổng quan, danh sách ý chính và các từ khóa. Sinh viên chọn độ dài **Ngắn**, **Vừa** hoặc **Chi tiết**; mỗi mức được lưu riêng nên đổi qua lại không phải gọi lại AI. Bản tóm tắt được lưu trong bảng `document_summary` (một bản cho mỗi cặp tài liệu + mức độ dài), vì vậy vẫn còn sau khi khởi động lại máy chủ. Khi tài liệu đổi tiêu đề, mô tả, tệp hoặc `updated_at`, `source_fingerprint` không còn khớp và bản mới được tạo; nút **Tạo lại** buộc tạo mới ngay. Giảng viên cũng xem và tạo lại bản tóm tắt cho tài liệu đang chọn ngay trong trang `/instructor/document`.

Tính năng dùng pipeline riêng trong `ai/document_summarizer.py`; model, API key và giới hạn token độc lập với AI tạo câu hỏi (`GEMINI_TEXT_QUESTION_MODEL`, `GEMINI_VISION_QUESTION_MODEL`) và trợ lý soạn bài giảng (`GEMINI_LESSON_WRITER_MODEL`). Hỗ trợ tài liệu PDF (OCR, số trang giới hạn), DOCX, PPTX, TXT và Markdown; tài liệu dài được rút gọn còn 40.000 ký tự đầu trước khi gửi model. Nếu tài liệu không có tệp, hệ thống dùng trường `content`; tài liệu không có văn bản đọc được sẽ báo lỗi rõ ràng thay vì suy đoán nội dung.

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `GEMINI_DOCUMENT_SUMMARY_MODEL` | `gemini-3.5-flash-lite` | Model riêng cho tóm tắt tài liệu. |
| `GEMINI_DOCUMENT_SUMMARY_API_KEY` | — (dùng `GEMINI_API_KEY`) | API key riêng nếu muốn tách hạn mức khỏi hai pipeline còn lại. |
| `GEMINI_DOCUMENT_SUMMARY_MAX_TOKENS` | `2048` (kẹp 256–8192) | Giới hạn token của phản hồi tóm tắt (áp dụng cho cả ba mức độ dài). |
| `GEMINI_DOCUMENT_SUMMARY_PDF_MAX_PAGES` | `5` (kẹp 1–20) | Số trang PDF tối đa trích xuất cho bản tóm tắt. |

### Soạn phụ đề cho video

Trong trang chỉnh sửa tài liệu của giảng viên, video tải trực tiếp lên website có trình soạn phụ đề: nhập mốc thời gian và lời thoại, xem trước khi phát, lưu bản nháp hoặc xuất bản. Mỗi ngôn ngữ có một bản phụ đề; hệ thống lưu tệp WebVTT (`.vtt`) trong kho tệp và lưu đường dẫn cùng dữ liệu đoạn phụ đề trong bảng `document_subtitle`. Người học có thể bật/tắt phụ đề bằng nút CC của trình phát video.

Video nhúng YouTube/Vimeo tiếp tục dùng phụ đề được quản lý trên nền tảng nguồn; muốn soạn trực tiếp trên website, hãy dùng video tải lên. Cần đặt `NEXT_PUBLIC_USE_MOCK_DATA=false` và đăng nhập bằng tài khoản giảng viên thật để lưu phụ đề vào cơ sở dữ liệu. Migration tạo bảng sẽ được áp dụng tự động khi backend khởi động.

### Lưu tệp bằng MinIO

Hệ thống hỗ trợ `local`, `blob` (Vercel Blob) và `minio`. Đặt `STORAGE_BACKEND=minio` để dùng MinIO cho file được lưu qua helper chung; đặt thêm `DOCUMENT_STORAGE_BACKEND=minio` để dùng MinIO cho tài liệu. Có thể để `auto` để tự chọn: Vercel Blob nếu có token, MinIO nếu có `MINIO_ENDPOINT`, nếu không thì lưu cục bộ.

Khi frontend gọi API từ domain khác, cấu hình `FRONTEND_URL` trên backend thành origin frontend (chỉ gồm scheme + host). Có thể khai báo nhiều origin, phân tách bằng dấu phẩy, để hỗ trợ cả domain production và preview; FastAPI cũng tự cho phép domain production đang dùng trên Vercel.

Cấu hình `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` và `MINIO_PUBLIC_URL` trong `.env`. Endpoint là địa chỉ backend kết nối; `MINIO_PUBLIC_URL` là URL gốc mà trình duyệt truy cập được, ví dụ `https://files.example.com`. Đặt `NEXT_PUBLIC_MINIO_PUBLIC_URL` bằng cùng URL gốc trước khi build frontend.

URL file được lưu trong cơ sở dữ liệu là URL public trực tiếp, tương tự Vercel Blob. Bucket cần cho phép tải object ẩn danh; chỉ bật quyền đọc công khai cho bucket chứa file vốn được phép chia sẻ công khai. Nếu dùng MinIO Client, có thể áp dụng policy tải công khai bằng `mc anonymous set download <alias>/<bucket>`.

## Hướng dẫn chi tiết việc cài đặt trang web trong máy

Sau khi đã chuẩn bị trước những yêu cầu cho việc cài đặt và sử dụng trong máy và tải thư mục chứa các file của trang web (bằng cách tải trực tiếp từ github hay git clone nó)thì việc cài đặt sẽ được tiến hành như sau:

- Tạo và bật môi trường ảo .venv để chạy backend:

  1. Mở terminal tại thư mục của trang web (thường là mở thu mục có tên là "Learning_app-master").
  2. Tạo môi trường ảo nếu chưa có:
     - Windows PowerShell: `python -m venv .venv`
  3. Kích hoạt môi trường ảo:
     - Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
  4. Kiểm tra Python đã sử dụng đúng môi trường ảo:
     - `python --version`
     - `python -c "import sys; print(sys.executable)"`

- Cài đặt backend FastAPI:

  1. Trong môi trường ảo, chạy:
     - `pip install -r requirements.txt`
  2. Nếu cần, cập nhật pip trước khi cài đặt:
     - `python -m pip install --upgrade pip`
  3. Kiểm tra cấu hình biến môi trường bằng cách sao chép `.env.example` thành `.env` và chỉnh sửa các giá trị sau:
     - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
     - `NEXT_URL=http://localhost:3000`
     - `GEMINI_API_KEY=` (thêm API key lấy từ Google AI Studio)
     - `DATABASE_URL=` hoặc để trống dùng SQLite tự động tạo file `learning_app.db`
     - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` nếu cần gửi mail
     - `MAIL_FROM_NAME=Hệ thống học tập trực tuyến`
  4. Khởi động backend:
     - `fastapi dev main.py` hoặc `uvicorn main:app --reload --host 127.0.0.1 --port 8000`
  5. Mở trình duyệt và kiểm tra backend:
     - `http://localhost:8000`
     - Hoặc `http://localhost:8000/docs` để xem Swagger/OpenAPI.

- Cài đặt frontend Next.js:

  1. Mở terminal mới hoặc giữ nguyên terminal hiện tại với môi trường ảo đã kích hoạt.
  2. Cài đặt Node.js dependencies:
     - `npm install`
  3. Nếu dùng pnpm hoặc yarn, có thể thay bằng `pnpm install` hoặc `yarn install`.
  4. Khởi động frontend:
     - `npm run dev`
  5. Mở trình duyệt và truy cập:
     - `http://localhost:3000`

- Lưu ý khi chạy đồng thời frontend và backend:

  + Backend phải chạy trước hoặc đồng thời để frontend có thể gọi API.
  + Nếu dùng SQLite, backend sẽ kết nối với file `learning_app.db` khi backend khởi động hoặc sẽ được tạo trong thư mục gốc dự án nếu không có.
  + Nếu sử dụng PostgreSQL, cấu hình `DATABASE_URL` hoặc các biến `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` phải chính xác và thêm dữ liệu tài khoản và profile tương ứng vào cơ sở dữ liệu bằng cách thủ công (mật khẩu thì mã hóa bằng Argon2, link tạo dòng mã hóa thủ công: https://argon2.online) hay chạy SQL script có tên là "PostgreSQL_base_data.sql".

- Kiểm tra và đăng nhập:

  1. Tạo người dùng mới hoặc đăng nhập bằng tài khoản hiện có nếu đã có sẵn dữ liệu.
  2. Nếu dùng chức năng phục hồi mật khẩu, kiểm tra email hoặc cấu hình Resend/SMTP đã hoạt động.
  3. Nếu cần reset dữ liệu, xóa file `learning_app.db` để backend tạo lại từ đầu (chỉ dùng với SQLite).
  4. Thông tin người dùng thử nghiệm (email mẫu không thể dùng cho chức năng phục hồi mật khẩu):
    Quản trị viên: tên đăng nhập: admin888, email mẫu: admin@gmail.com, mật khẩu: admin12345.
    Giảng viên: tên đăng nhập: instructor888, email mẫu: instructor@gmail.com, mật khẩu: instructor12345.
    Sinh viên: tên đăng nhập: student888, email mẫu: student@gmail.com, mật khẩu: student12345.

## Quy ước đọc cấu hình dùng chung (ai/env_utils.py)

Cả hai pipeline xử lý AI — pipeline OCR cục bộ (`ai/ocr_module.py`) và pipeline AI tạo câu hỏi (`ai/question_generator.py`) — đều đọc cấu hình từ biến môi trường thông qua **module dùng chung `ai/env_utils.py`**. Điều này đảm bảo hai pipeline không bao giờ lệch nhau về cách đọc/parse cùng một biến.

### Thứ tự ưu tiên khi đọc

1. Biến môi trường của process (`os.getenv`) — ưu tiên cao nhất.
2. File `.env` ở thư mục gốc dự án — fallback khi biến chưa được nạp vào process environment.
3. Giá trị mặc định khai báo trong code — dùng khi biến không tồn tại ở bất kỳ đâu.

Mọi giá trị trả về đều được cắt khoảng trắng và bỏ dấu ngoặc kép/nháy ở hai đầu.

### Các helper

| Hàm | Mô tả |
| --- | --- |
| `read_env_value(key)` | Đọc giá trị thô, trả về `None` nếu không tìm thấy. |
| `read_env_bool(key, default)` | Đọc boolean (`1`/`true`/`yes`/`on`). Giá trị rỗng tính như chưa đặt → trả `default`. |
| `read_env_int(key, default)` | Đọc số nguyên dương. Giá trị không parse được hoặc < 1 → trả `default`. |
| `read_env_int_clamped(key, default, min, max)` | Đọc số nguyên rồi kẹp trong `[min, max]`. |
| `read_env_float(key, default)` | Đọc số thực không âm. Lỗi parse hoặc âm → trả `default`. |

### Biến môi trường pipeline OCR (RAPIDOCR_*)

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `RAPIDOCR_TRIM_MARGINS` | `true` | Cắt lề trắng trước khi OCR để tăng độ chính xác. |
| `RAPIDOCR_MAX_SIDE` | `1536` (kẹp 256–4096) | Giới hạn cạnh dài nhất của ảnh và trang PDF sau render. |
| `RAPIDOCR_MAX_IMAGE_PIXELS` | `3000000` (kẹp 1–12 triệu) | Từ chối ảnh lớn hơn giới hạn trước khi tiền xử lý để tránh giải mã ảnh quá lớn. |
| `RAPIDOCR_MAX_PDF_PAGES` | `2` (kẹp 1–10) | Số trang tối đa OCR trong một lượt; `max_pages` do caller truyền vào vẫn chịu giới hạn này. |
| `RAPIDOCR_PDF_RENDER_SCALE` | `1.5` | Độ phân giải render PDF; tự giảm thêm nếu cần để không vượt `RAPIDOCR_MAX_SIDE`. |
| `RAPIDOCR_ONNX_THREADS` | `1` (kẹp 1–2) | Số luồng ONNX Runtime cho mỗi phiên mô hình; giữ `1` trên Render Free 0.1 CPU. |
| `RAPIDOCR_ONNX_CPU_MEM_ARENA` | `false` | Tắt CPU memory arena của ONNX Runtime để hạn chế bộ nhớ giữ lại giữa các lần OCR; có thể giảm tốc độ. |
| `RAPIDOCR_CACHE_SIZE` | `2` (0–100) | Số kết quả OCR lưu trong cache; đặt `0` để tắt cache. |
| `RAPIDOCR_DESKEW` | `false` | Tự phát hiện và xoay ảnh bị nghiêng; bật có thể cải thiện ảnh scan nghiêng nhưng dùng thêm CPU/RAM. |
| `RAPIDOCR_ENHANCED_PREPROCESSING` | `false` | Bật tăng tương phản, lọc nhiễu và phóng to trang nhỏ; có thể cải thiện ảnh khó nhưng tạo thêm ảnh tạm và tốn CPU. |

Với Render Free (0.1 CPU, 512 MB RAM), dùng các giá trị mặc định ở bảng trên: một worker Uvicorn, ONNX một luồng, cạnh ảnh tối đa 1536 px, giới hạn 3 triệu pixel/ảnh, tối đa 2 trang PDF/lượt, cache 2 kết quả, deskew/tiền xử lý nâng cao tắt và CPU memory arena tắt. OCR được tuần tự hóa và dùng lại một engine trong tiến trình; PDF có text layer được trích xuất trực tiếp, còn trang scan được render từng trang và các bitmap/ảnh trung gian được đóng sau khi xử lý.

Các giới hạn này giảm đỉnh RAM nhưng không thể bảo đảm một mức RAM trống cố định: 512 MB dùng chung cho Python, RapidOCR/ONNX, các request đồng thời và các tính năng khác. Nếu Render vẫn báo vượt RAM, giảm `RAPIDOCR_MAX_SIDE` xuống `1280`, `RAPIDOCR_MAX_IMAGE_PIXELS` xuống `2000000`, `RAPIDOCR_MAX_PDF_PAGES` xuống `1`, và `RAPIDOCR_CACHE_SIZE` xuống `0`. Không tăng số worker hoặc luồng ONNX trên gói này. Ảnh vượt giới hạn pixel sẽ bị từ chối; tăng giới hạn có thể làm tăng đỉnh RAM đáng kể.

### Biến môi trường pipeline AI tạo câu hỏi (AI_GENERATOR_*, HF_*)

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `AI_GENERATOR_MAX_QUESTIONS` | `20` | Số câu hỏi tối đa mỗi lần tạo (ưu tiên hơn `NEXT_PUBLIC_...`). |
| `NEXT_PUBLIC_AI_GENERATOR_MAX_QUESTIONS` | `20` | Số câu hỏi tối đa, dùng khi biến trên chưa đặt. |
| `AI_GENERATOR_SELF_CRITIQUE` | `true` | Bật bước AI tự phản biện, đánh giá lại bộ câu hỏi. |
| `AI_GENERATOR_TEMPERATURE` | `0.7` | Nhiệt độ sinh câu hỏi. |
| `AI_GENERATOR_CRITIQUE_TEMPERATURE` | `0.1` | Nhiệt độ bước phản biện. |
| `AI_GENERATOR_MAX_TOKENS` | `4096` | Số token tối đa của phản hồi. |
| `HF_VISUAL_IMAGE_MAX_DIM` | `1024` (kẹp 512–2048) | Giới hạn cạnh dài nhất ảnh gửi cho vision model (giảm token). |
| `HF_VISUAL_IMAGE_JPEG_QUALITY` | `80` (kẹp 50–95) | Chất lượng nén JPEG. |
| `HF_VISUAL_TRIM_MARGINS` | `true` | Cắt lề trắng trước khi mã hóa ảnh. |
| `HF_VISUAL_SKIP_BLANK_PAGES` | `true` | Bỏ trang trắng/bìa khi render PDF. |
| `HF_VISUAL_DEDUPE_FRAMES` | `true` | Loại khung hình video gần giống nhau (slide tĩnh). |
| `HF_VISUAL_DESKEW` | `true` | Tự chỉnh nghiêng ảnh trước khi mã hóa. |
| `GEMINI_TEXT_QUESTION_MODEL` | `gemini-3.8-flash` | Model xử lý văn bản thuần. |
| `GEMINI_VISION_QUESTION_MODEL` | `gemini-3.8-flash` | Model thị giác (xử lý ảnh, PDF, video). |
| `GEMINI_API_KEY` | — | API key Gemini lấy từ Google AI Studio. |

### Quy ước khi thêm biến cấu hình mới

- **Luôn đọc qua `ai/env_utils.py`** thay vì gọi trực tiếp `os.getenv(...)`/`load_dotenv` rồi tự parse — tránh tạo thêm bản sao logic lệch nhau giữa hai pipeline.
- Khai báo mặc định hợp lý trong code và ghi chú biến mới vào `.env.example` (kèm dải giá trị nếu có kẹp min/max).
- Với biến boolean, dùng `read_env_bool`; với số nguyên có dải hợp lệ, dùng `read_env_int_clamped` để chặn giá trị bất thường ngay tại nguồn.
