Đây là Trang Web học tập trực tuyến (ứng dụng web học tập trực tuyến) có tích hợp trợ lý AI nhằm hỗ trợ việc tự ôn tập hay tạo câu hỏi cho bài kiểm tra. 

## Link truy cập trực tuyến

- backend: https://learning-app-5hw8.onrender.com

- frontend: https://learning-app-zeta-nine.vercel.app/

- Hướng dẫn ngắn: truy cập backend trước, khi nó hiện dòng tin nhắn "Chào mừng đến với ứng dụng học tập trực tuyến!" thì mới nên truy cập frontend, đảm bảo backend đang chạy khi đang sử dụng trang web.

- Giải thích vì sao phải mở backend trước: Do backend sử dụng render miễn phí nên sẽ vào trạng thái ngủ sau một thời gian frontend không có gửi yêu cầu xử lý và phải mất tầm 1 phút để khởi động lại khi truy cập lại hoặc khi frontend gửi yêu cầu xử lý nếu đang ở trạng thái ngủ.

- Hạn chế của truy cập trực tuyến:

+ Không thể sử dụng được AI thị giác (HF_VISION_QUESTION_MODEL) vì đang sử dụng hugging face api với token free nên nó không cho phép truy cập.

+ Việc tạo câu hỏi từ hình ảnh, học liệu pdf và video mà số từ tổng cộng dưới 50 từ là không được vì hệ thống sẽ đưa dữ liệu cho AI thị giác (mà AI thị giác thì không thể sử dụng được) hay vì hệ thống sẽ đưa dữ liệu là dòng văn bản lấy được từ hình ảnh, học liệu pdf và video qua OCR cho AI xử lý văn bản thuần (HF_TEXT_QUESTION_MODEL).

+ OCR để lấy dữ liệu văn bản từ hình ảnh, học liệu pdf và video qua OCR có chất lượng không cao và có thể gây tình trạng hết bộ nhớ cho backend nếu dữ liệu xử lý lớn (ước tính 50 trang PDF trở lên).

## Những yêu cầu cho việc cài đặt và sử dụng trong máy (local)

- Cần thiết để chạy trang web (Có thể sử dụng phiên bản cũ hơn hoặc mới hơn nhưng không đảm bảo về khả năng tích hợp của phiên bản):
+ Python phiên bản 3.14.3.
+ Node.js phiên bản 25.8.2.

- Cần cho chức năng tạo người dùng cho quản trị viên và phục hồi mật khẩu:
 SMTP (Dễ nhất là gmail) hoặc sử dụng Resend với một tên miền hợp lệ.

- Cần cho chức năng sử dụng trợ lý AI:
 Tài khoản Hugging Face (để lấy token gọi API).

- Cơ sở dữ liệu hỗ trợ:
+ PostgreSQL
+ SQLite (Là file learning_app.db và sẽ tự động tạo nếu không có)

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
     - `HF_TOKEN=` (thêm token Hugging Face của bạn)
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
    Giảng viên: tên đăng nhập: student888, email mẫu: student@gmail.com, mật khẩu: student12345.
