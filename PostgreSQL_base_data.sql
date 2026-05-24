INSERT INTO public.user (username,email,password,icon,"role",is_password_reset,created_at,updated_at) VALUES
	 ('admin888','admin@gmail.com','$argon2id$v=19$m=65536,t=3,p=4$jzQcZP3AuZXo4pjRcY3jbA$uFyzeHr5SC4HIe1UkQaYKsVtt9OR6YtmLkd1dkNJyxA','/icon.png','admin',0,'2026-05-17 16:39:06.529224','2026-05-17 16:43:45.625139'),
	 ('instructor888','instructor@gmail.com','$argon2id$v=19$m=65536,t=3,p=4$+4j+bCLbD9V8Q+2UhAotFA$coy3PoOen3KzkxDBlmUIhMCT1Uw7r7/7Xmuw6oNPXmA','/icon.png','instructor',0,'2026-05-19 14:31:59.152156','2026-05-19 14:31:59.152217'),
	 ('student888','student@gmail.com','$argon2id$v=19$m=65536,t=3,p=4$Nrr0tFTS+A5L6wA3y4i9qQ$jTrjkpm5E+5m4ZF7SIsxi0qdpowvjbZRl9xZDJKKBFM','/icon.png','student',0,'2026-05-18 16:33:10.149127','2026-05-20 16:53:38.10566');
INSERT INTO public.profile (user_id,name,email,location,organization,description,specialization) VALUES
	 (1,'Nguyễn Văn A','admin@gmail.com','Thành phố Hồ Chí Minh','Đơn vị chưa cập nhật','Tài khoản được tạo từ cơ sở dữ liệu.','Chưa cập nhật'),
	 (2,'Nguyễn Văn B','instructor@gmail.com','Thành phố Hồ Chí Minh','Đơn vị chưa cập nhật','Tài khoản được tạo bởi quản trị viên.','Chưa cập nhật'),
	 (3,'Nguyễn Văn C','student@gmail.com','Thành phố Hồ Chí Minh','Đơn vị chưa cập nhật','Tài khoản được tạo từ biểu mẫu đăng ký.','Chưa cập nhật');
INSERT INTO public.category ("name",description,created_at,updated_at) VALUES
	 ('Lập trình','Đây là phân loại cho các khóa học liên quan đến lập trình','2026-05-18 17:03:10.143571','2026-05-18 17:03:10.14364');