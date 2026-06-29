import type { FastAPICourse } from "./api_course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_JOIN_COURSE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type JoinCourseModule = {
  id: number;
  course_id: number;
  title: string;
  module_sequence: number;
  type: string;
  introduction: string;
  total_component: number;
};

export type JoinCourseComponent = {
  id: number;
  course_id: number;
  module_id: number;
  title: string;
  component_sequence: number;
  component_type: "document" | "exam";
  ref_id: number | null;
  summary: string;
  estimated_minutes: number;
  is_preview: boolean;
};

export type JoinCourseCourseProgress = {
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
  completed_at?: string | null;
};

export type JoinCourseModuleProgress = {
  course_id: number;
  module_id: number;
  user_id: number;
  components_completed: number;
  is_complete: boolean;
  completed_at?: string | null;
};

export type JoinCourseComponentProgress = {
  id?: number;
  user_id: number;
  course_id: number;
  module_id: number;
  course_component_id: number;
  is_completed: boolean;
  completed_at?: string | null;
};

export type StudentJoinCourseDetail = {
  course: FastAPICourse & {
    category_name: string;
    instructor_name: string;
    instructor_email: string;
  };
  modules: JoinCourseModule[];
  components: JoinCourseComponent[];
  is_enrolled: boolean;
  progress_percentage: number;
  total_documents: number;
  total_exams: number;
  estimated_total_minutes: number;
};

export type JoinCourseResult = {
  courseProgress: JoinCourseCourseProgress;
  moduleProgresses: JoinCourseModuleProgress[];
  componentProgresses: JoinCourseComponentProgress[];
};

type FastApiError = {
  detail?: string;
};

type FastApiCategory = {
  id: number;
  name: string;
};

type FastApiUser = {
  id: number;
  username: string;
  email?: string;
};

const endpoints = {
  courseById: (courseId: number) => `${API_BASE_URL}/course/${courseId}`,
  categoryList: () => `${API_BASE_URL}/category/`,
  userList: () => `${API_BASE_URL}/user/`,
  modulesByCourse: (courseId: number) => `${API_BASE_URL}/module/course/${courseId}`,
  componentsByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_component/course/${courseId}`,
  courseProgressByUser: (userId: number) =>
    `${API_BASE_URL}/course_progress/user/${userId}`,
  createCourseProgress: () => `${API_BASE_URL}/course_progress/create`,
  createModuleProgress: () => `${API_BASE_URL}/module_progress/create`,
  createComponentProgress: () => `${API_BASE_URL}/course_component_progress/create`,
  updateCourse: (courseId: number) => `${API_BASE_URL}/course/update/${courseId}`,
};

const mockCategories: FastApiCategory[] = [
  { id: 1, name: "Hướng dẫn sử dụng trang web" },
  { id: 2, name: "Lập trình" },
  { id: 3, name: "Toán học" },
  { id: 4, name: "Dữ liệu" },
];

const mockUsers: FastApiUser[] = [
  { id: 2, username: "Võ Thiên Sơn", email: "vothienson@admin.edu.vn" },
  { id: 3, username: "Trần Thị Ngọc Sanh", email: "tranthingocsanh@instructor.edu.vn" },
  { id: 4, username: "Nguyễn Thị Văn Sơn", email: "nguyenthivanson@instructor.edu.vn" },
  { id: 5, username: "Võ Thăng Tiến", email: "vothangtien@instructor.edu.vn" },
  { id: 6, username: "Trần Thị Ngọc Nhung", email: "tranthingocnhung@instructor.edu.vn" },
  { id: 7, username: "Nguyễn Thiên Long", email: "nguyenthienlong@instructor.edu.vn" },
];

const mockCourses: FastAPICourse[] = [
  {
    id: 1,
    title: "Nền tảng xây dựng ứng dụng học tập với AI",
    category_id: 1,
    instructor_id: 2,
    introduction:
      "Khóa học giúp sinh viên học trực tuyến theo module và thành phần.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Cơ bản",
    total_module: 3,
    total_student: 42,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 2,
    title: "Lập trình cơ bản",
    category_id: 2,
    instructor_id: 7,
    introduction:
      "Khóa học sẽ dạy về những loại lệnh cơ bản trong lập trình qua C++.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Cơ bản",
    total_module: 6,
    total_student: 123,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 4,
    title: "Toán rời rạc",
    category_id: 3,
    instructor_id: 4,
    introduction:
      "Khóa học sẽ dạy về những thuật toán được ứng dụng nhiều trong CNTT.",
    description:
      "Khóa học tập trung vào tư duy logic, đồ thị, quan hệ và các kỹ thuật chứng minh cần thiết cho ngành công nghệ thông tin.",
    level: "Trung bình",
    total_module: 5,
    total_student: 115,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 7,
    title: "Cơ sở dữ liệu",
    category_id: 4,
    instructor_id: 6,
    introduction:
      "Khóa học sẽ dạy về cơ sở dữ liệu và các khái niệm liên quan.",
    description:
      "Khóa học hướng dẫn cách phân tích dữ liệu, thiết kế lược đồ bảng, viết truy vấn SQL và vận dụng trong các bài toán hệ thống học tập.",
    level: "Trung bình",
    total_module: 4,
    total_student: 102,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
];

const mockModules: JoinCourseModule[] = [
  {
    id: 11,
    course_id: 1,
    title: "Module 1: Làm quen với khóa học",
    module_sequence: 1,
    type: "Học liệu",
    introduction:
      "Nắm được mục tiêu khóa học và cách theo dõi tiến độ học tập.",
    total_component: 2,
  },
  {
    id: 12,
    course_id: 1,
    title: "Module 2: Học qua tài liệu có hướng dẫn",
    module_sequence: 2,
    type: "Học liệu",
    introduction:
      "Đọc tài liệu và củng cố kiến thức qua một bài kiểm tra ngắn.",
    total_component: 3,
  },
  {
    id: 13,
    course_id: 1,
    title: "Module 3: Tổng kết và tự đánh giá",
    module_sequence: 3,
    type: "Đánh giá",
    introduction:
      "Ôn tập lại toàn bộ kiến thức trước khi kết thúc khóa học.",
    total_component: 2,
  },
    {
    id: 21,
    course_id: 2,
    title: "Module 1: Giới thiệu về lập trình",
    module_sequence: 1,
    type: "Học liệu",
    introduction:
      "Nắm được mục tiêu khóa học và cách theo dõi tiến độ học tập.",
    total_component: 2,
  },
  {
    id: 22,
    course_id: 2,
    title: "Module 2: Học qua tài liệu có hướng dẫn",
    module_sequence: 2,
    type: "Học liệu",
    introduction:
      "Đọc tài liệu và củng cố kiến thức qua một bài kiểm tra ngắn.",
    total_component: 3,
  },
  {
    id: 23,
    course_id: 2,
    title: "Module 3: Thực hành việc lập trình",
    module_sequence: 3,
    type: "Học liệu",
    introduction:
      "Tạo ra một chương trình đơn giản để thực hành những kiến thức đã học.",
    total_component: 2,
  },
  {
    id: 24,
    course_id: 2,
    title: "Module 4: Tổng kết và tự đánh giá",
    module_sequence: 3,
    type: "Đánh giá",
    introduction:
      "Ôn tập lại toàn bộ kiến thức trước khi kết thúc khóa học.",
    total_component: 2,
  },
  {
    id: 41,
    course_id: 4,
    title: "Module 1: Tư duy tập hợp và logic",
    module_sequence: 1,
    type: "Học liệu",
    introduction:
      "Làm quen với khái niệm tập hợp, mệnh đề logic và suy luận cơ bản.",
    total_component: 2,
  },
  {
    id: 42,
    course_id: 4,
    title: "Module 2: Quan hệ và hàm",
    module_sequence: 2,
    type: "Học liệu",
    introduction:
      "Hiểu quan hệ, ánh xạ, hàm số và ứng dụng trong mô hình hệ thống.",
    total_component: 2,
  },
  {
    id: 43,
    course_id: 4,
    title: "Module 3: Đồ thị và cây",
    module_sequence: 3,
    type: "Học liệu",
    introduction:
      "Khảo sát đồ thị, cây và những bài toán đường đi thường gặp.",
    total_component: 2,
  },
  {
    id: 44,
    course_id: 4,
    title: "Module 4: Đại số Boole",
    module_sequence: 4,
    type: "Học liệu",
    introduction:
      "Kết nối đại số Boole với biểu thức logic và mạch số.",
    total_component: 2,
  },
  {
    id: 45,
    course_id: 4,
    title: "Module 5: Ôn tập và đánh giá",
    module_sequence: 5,
    type: "Đánh giá",
    introduction:
      "Tổng hợp kiến thức và tự đánh giá mức độ nắm vững môn học.",
    total_component: 2,
  },
  {
    id: 71,
    course_id: 7,
    title: "Module 1: Tổng quan cơ sở dữ liệu",
    module_sequence: 1,
    type: "Học liệu",
    introduction:
      "Nắm các khái niệm bảng, bản ghi, khóa và quan hệ dữ liệu.",
    total_component: 2,
  },
  {
    id: 72,
    course_id: 7,
    title: "Module 2: Mô hình hóa dữ liệu",
    module_sequence: 2,
    type: "Học liệu",
    introduction:
      "Thiết kế sơ đồ thực thể kết hợp và chuyển đổi sang lược đồ quan hệ.",
    total_component: 2,
  },
  {
    id: 73,
    course_id: 7,
    title: "Module 3: Truy vấn SQL cơ bản",
    module_sequence: 3,
    type: "Học liệu",
    introduction:
      "Làm việc với các truy vấn chọn, lọc, sắp xếp và kết nối bảng.",
    total_component: 2,
  },
  {
    id: 74,
    course_id: 7,
    title: "Module 4: Thực hành mini project",
    module_sequence: 4,
    type: "Đánh giá",
    introduction:
      "Áp dụng toàn bộ kiến thức vào bài toán quản lý dữ liệu nhỏ.",
    total_component: 2,
  },
];

const mockComponents: JoinCourseComponent[] = [
  {
    id: 1001,
    course_id: 1,
    module_id: 11,
    title: "Tài liệu: Mục tiêu của khóa học",
    component_sequence: 1,
    component_type: "document",
    ref_id: 201,
    summary:
      "Đọc tổng quan về lộ trình học, cách đánh dấu hoàn thành và quy tắc mở khóa.",
    estimated_minutes: 12,
    is_preview: true,
  },
  {
    id: 1002,
    course_id: 1,
    module_id: 11,
    title: "Bài kiểm tra: Kiểm tra hiểu biết ban đầu",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 301,
    summary:
      "Bài kiểm tra ngắn để xác nhận bạn đã nắm phần giới thiệu của khóa học.",
    estimated_minutes: 10,
    is_preview: false,
  },
  {
    id: 1003,
    course_id: 1,
    module_id: 12,
    title: "Tài liệu: Quy trình học theo module",
    component_sequence: 1,
    component_type: "document",
    ref_id: 202,
    summary:
      "Tài liệu mô tả cách đọc nội dung, ghi chú và theo dõi tiến độ từng bước.",
    estimated_minutes: 15,
    is_preview: false,
  },
  {
    id: 1004,
    course_id: 1,
    module_id: 12,
    title: "Tài liệu: Cách chuẩn bị trước bài kiểm tra",
    component_sequence: 2,
    component_type: "document",
    ref_id: 203,
    summary:
      "Danh sách kiểm tra trước khi làm bài để tránh bỏ sót phần quan trọng.",
    estimated_minutes: 8,
    is_preview: false,
  },
  {
    id: 1005,
    course_id: 1,
    module_id: 12,
    title: "Bài kiểm tra: Đánh giá giữa khóa",
    component_sequence: 3,
    component_type: "exam",
    ref_id: 302,
    summary:
      "Bài kiểm tra xác nhận bạn đã đi hết các tài liệu trong module 2.",
    estimated_minutes: 20,
    is_preview: false,
  },
  {
    id: 1006,
    course_id: 1,
    module_id: 13,
    title: "Tài liệu: Tổng hợp nội dung trọng tâm",
    component_sequence: 1,
    component_type: "document",
    ref_id: 204,
    summary:
      "Tài liệu tóm tắt những điểm cần nhớ trước khi kết thúc khóa học.",
    estimated_minutes: 10,
    is_preview: false,
  },
  {
    id: 1007,
    course_id: 1,
    module_id: 13,
    title: "Bài kiểm tra: Tự đánh giá cuối khóa",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 303,
    summary:
      "Bài kiểm tra cuối khóa để chốt lại toàn bộ tiến độ học tập.",
    estimated_minutes: 25,
    is_preview: false,
  },
  {
    id: 2001,
    course_id: 2,
    module_id: 21,
    title: "Tài liệu: Cài đặt môi trường lập trình",
    component_sequence: 1,
    component_type: "document",
    ref_id: 205,
    summary:
      "Hướng dẫn cài đặt môi trường lập trình C++ trên máy tính cá nhân.",
    estimated_minutes: 12,
    is_preview: true,
  },
  {
    id: 2002,
    course_id: 2,
    module_id: 21,
    title: "Bài kiểm tra: Cài đặt môi trường",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 206,
    summary:
      "Bài kiểm tra xác nhận bạn đã cài đặt thành công môi trường lập trình.",
    estimated_minutes: 10,
    is_preview: false,
  },
  {
    id: 2003,
    course_id: 2,
    module_id: 22,
    title: "Tài liệu: Cú pháp cơ bản",
    component_sequence: 1,
    component_type: "document",
    ref_id: 207,
    summary:
      "Học về các cú pháp cơ bản trong C++ như biến, kiểu dữ liệu, toán tử.",
    estimated_minutes: 18,
    is_preview: false,
  },
  {
    id: 2004,
    course_id: 2,
    module_id: 22,
    title: "Bài kiểm tra: Cú pháp cơ bản",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 208,
    summary:
      "Bài kiểm tra xác nhận bạn đã nắm được các cú pháp cơ bản trong C++.",
    estimated_minutes: 15,
    is_preview: false,
  },
  {
    id: 2005,
    course_id: 2,
    module_id: 23,
    title: "Tài liệu: Cấu trúc điều khiển",
    component_sequence: 1,
    component_type: "document",
    ref_id: 209,
    summary:
      "Học về các cấu trúc điều khiển như if-else, switch-case, vòng lặp for, while.",
    estimated_minutes: 20,
    is_preview: false,
  },
  {
    id: 2006,
    course_id: 2,
    module_id: 23,
    title: "Bài kiểm tra: Cấu trúc điều khiển",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 210,
    summary:
      "Bài kiểm tra xác nhận bạn đã nắm được các cấu trúc điều khiển trong C++.",
    estimated_minutes: 15,
    is_preview: false,
  },
  {
    id: 2007,
    course_id: 2,
    module_id: 23,
    title: "Tài liệu: Thực hành lập trình",
    component_sequence: 3,
    component_type: "document",
    ref_id: 211,
    summary:
      "Thực hành viết các chương trình đơn giản để áp dụng kiến thức về cấu trúc điều khiển trong C++.",
    estimated_minutes: 20,
    is_preview: false,
  },
  {
    id: 2008,
    course_id: 2,
    module_id: 24,
    title: "Tài liệu: Hàm và các câu lệnh khác trong C++",
    component_sequence: 1,
    component_type: "document",
    ref_id: 211,
    summary:
      "Học về cách định nghĩa và sử dụng hàm trong C++ cũng như các câu lệnh khác trong C++.",
    estimated_minutes: 20,
    is_preview: false,
  },
  {
    id: 2009,
    course_id: 2,
    module_id: 24,
    title: "Tài liệu: Tìm hiểu về các công cụ hỗ trợ và ứng dụng thực tế của C++",
    component_sequence: 2,
    component_type: "document",
    ref_id: 212,
    summary:
      "Học về các công cụ hỗ trợ và ứng dụng thực tế của C++.",
    estimated_minutes: 15,
    is_preview: false,
  },
  {
    id: 2010,
    course_id: 2,
    module_id: 24,
    title: "Tài liệu: Ôn tập và tổng hợp kiến thức",
    component_sequence: 3,
    component_type: "document",
    ref_id: 213,
    summary:
      "Tổng hợp lại các kiến thức đã học trong khóa học C++.",
    estimated_minutes: 20,
    is_preview: false,
  },
  {
    id: 4001,
    course_id: 4,
    module_id: 41,
    title: "Tài liệu: Mệnh đề và bảng chân trị",
    component_sequence: 1,
    component_type: "document",
    ref_id: 401,
    summary:
      "Làm quen với mệnh đề, phép kéo theo, phép tương đương và bảng chân trị.",
    estimated_minutes: 16,
    is_preview: true,
  },
  {
    id: 4002,
    course_id: 4,
    module_id: 41,
    title: "Bài kiểm tra: Tư duy logic cơ bản",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 402,
    summary:
      "Bộ câu hỏi ngắn để kiểm tra cách đọc mệnh đề và suy luận logic.",
    estimated_minutes: 12,
    is_preview: false,
  },
  {
    id: 4003,
    course_id: 4,
    module_id: 42,
    title: "Tài liệu: Quan hệ và tính chất",
    component_sequence: 1,
    component_type: "document",
    ref_id: 403,
    summary:
      "Tìm hiểu phản xạ, đối xứng, bắc cầu và các ví dụ quen thuộc.",
    estimated_minutes: 18,
    is_preview: false,
  },
  {
    id: 4004,
    course_id: 4,
    module_id: 42,
    title: "Bài kiểm tra: Phân tích quan hệ",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 404,
    summary:
      "Nhận diện các tính chất của quan hệ qua những tình huống cụ thể.",
    estimated_minutes: 14,
    is_preview: false,
  },
  {
    id: 4005,
    course_id: 4,
    module_id: 43,
    title: "Tài liệu: Đồ thị và biểu diễn",
    component_sequence: 1,
    component_type: "document",
    ref_id: 405,
    summary:
      "Học cách mô tả đồ thị vô hướng, có hướng và ma trận kề.",
    estimated_minutes: 20,
    is_preview: false,
  },
  {
    id: 4006,
    course_id: 4,
    module_id: 43,
    title: "Bài kiểm tra: Đường đi và cây",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 406,
    summary:
      "Kiểm tra hiểu biết về cây khung, đường đi ngắn và bậc của đỉnh.",
    estimated_minutes: 15,
    is_preview: false,
  },
  {
    id: 4007,
    course_id: 4,
    module_id: 44,
    title: "Tài liệu: Biểu thức Boole",
    component_sequence: 1,
    component_type: "document",
    ref_id: 407,
    summary:
      "Tìm hiểu phép toán Boole và các quy tắc biến đổi biểu thức logic.",
    estimated_minutes: 15,
    is_preview: false,
  },
  {
    id: 4008,
    course_id: 4,
    module_id: 44,
    title: "Bài kiểm tra: Đại số Boole",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 408,
    summary:
      "Bài tập rút gọn biểu thức và nhận diện mạch logic cơ bản.",
    estimated_minutes: 13,
    is_preview: false,
  },
  {
    id: 4009,
    course_id: 4,
    module_id: 45,
    title: "Tài liệu: Hệ thống hóa kiến thức",
    component_sequence: 1,
    component_type: "document",
    ref_id: 409,
    summary:
      "Bản tóm tắt giúp ôn nhanh trước bài đánh giá cuối khóa.",
    estimated_minutes: 10,
    is_preview: false,
  },
  {
    id: 4010,
    course_id: 4,
    module_id: 45,
    title: "Bài kiểm tra: Tổng kết toán rời rạc",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 410,
    summary:
      "Bài đánh giá tổng hợp toàn bộ nội dung chính của khóa học.",
    estimated_minutes: 25,
    is_preview: false,
  },
  {
    id: 7001,
    course_id: 7,
    module_id: 71,
    title: "Tài liệu: Khái niệm bảng và khóa",
    component_sequence: 1,
    component_type: "document",
    ref_id: 701,
    summary:
      "Làm quen với bảng dữ liệu, khóa chính, khóa ngoại và vai trò của chúng.",
    estimated_minutes: 15,
    is_preview: true,
  },
  {
    id: 7002,
    course_id: 7,
    module_id: 71,
    title: "Bài kiểm tra: Khái niệm cơ sở dữ liệu",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 702,
    summary:
      "Đánh giá nhanh kiến thức nền tảng trước khi đi sâu vào thiết kế hệ thống.",
    estimated_minutes: 12,
    is_preview: false,
  },
  {
    id: 7003,
    course_id: 7,
    module_id: 72,
    title: "Tài liệu: Sơ đồ ERD",
    component_sequence: 1,
    component_type: "document",
    ref_id: 703,
    summary:
      "Thực hành phân tích thực thể, thuộc tính và mối quan hệ trong bài toán.",
    estimated_minutes: 18,
    is_preview: false,
  },
  {
    id: 7004,
    course_id: 7,
    module_id: 72,
    title: "Bài kiểm tra: Chuyển đổi sang bảng quan hệ",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 704,
    summary:
      "Kiểm tra khả năng chuyển mô hình ERD sang lược đồ quan hệ chuẩn.",
    estimated_minutes: 16,
    is_preview: false,
  },
  {
    id: 7005,
    course_id: 7,
    module_id: 73,
    title: "Tài liệu: Truy vấn SELECT và JOIN",
    component_sequence: 1,
    component_type: "document",
    ref_id: 705,
    summary:
      "Ôn luyện các mẫu truy vấn cơ bản phục vụ bài toán báo cáo dữ liệu.",
    estimated_minutes: 22,
    is_preview: false,
  },
  {
    id: 7006,
    course_id: 7,
    module_id: 73,
    title: "Bài kiểm tra: SQL thực hành",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 706,
    summary:
      "Giải các câu hỏi liên quan tới lọc dữ liệu, kết nối bảng và sắp xếp.",
    estimated_minutes: 18,
    is_preview: false,
  },
  {
    id: 7007,
    course_id: 7,
    module_id: 74,
    title: "Tài liệu: Hướng dẫn mini project",
    component_sequence: 1,
    component_type: "document",
    ref_id: 707,
    summary:
      "Tài liệu mô tả bài toán thực hành cuối khóa và các yêu cầu cần đạt.",
    estimated_minutes: 14,
    is_preview: false,
  },
  {
    id: 7008,
    course_id: 7,
    module_id: 74,
    title: "Bài kiểm tra: Đánh giá mini project",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 708,
    summary:
      "Phần đánh giá cuối cùng để xác nhận khả năng áp dụng cơ sở dữ liệu.",
    estimated_minutes: 20,
    is_preview: false,
  },
];

let mockCourseProgresses: JoinCourseCourseProgress[] = [
  {
    course_id: 1,
    user_id: 1,
    module_completed: 2,
    is_complete: false,
    final_score: 82,
    completed_at: null,
  },
  {
    course_id: 4,
    user_id: 1,
    module_completed: 5,
    is_complete: true,
    final_score: 91,
    completed_at: "2026-05-01T10:00:00.000Z",
  },
];

let mockModuleProgresses: JoinCourseModuleProgress[] = [
  {
    course_id: 1,
    module_id: 11,
    user_id: 1,
    components_completed: 1,
    is_complete: false,
    completed_at: null,
  },
];

let mockComponentProgresses: JoinCourseComponentProgress[] = [
  {
    id: 1,
    user_id: 1,
    course_id: 1,
    module_id: 11,
    course_component_id: 1001,
    is_completed: true,
    completed_at: "2026-04-28T08:00:00.000Z",
  },
];

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function getJsonOrFallback<T>(url: string, fallbackValue: T): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return fallbackValue;
  }

  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

function buildCourseLabelData(course: FastAPICourse) {
  const instructor = mockUsers.find((user) => user.id === course.instructor_id);
  return {
    category_name:
      mockCategories.find((category) => category.id === course.category_id)?.name ??
      "Chưa phân loại",
    instructor_name: instructor?.username ?? "Chưa cập nhật",
    instructor_email: instructor?.email ?? "",
  };
}

function calculateProgressPercentage(
  course: FastAPICourse,
  progress: JoinCourseCourseProgress | undefined,
): number {
  if (!progress || course.total_module <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((progress.module_completed / course.total_module) * 100),
  );
}

function buildJoinCourseDetail(
  course: FastAPICourse,
  modules: JoinCourseModule[],
  components: JoinCourseComponent[],
  progress: JoinCourseCourseProgress | undefined,
): StudentJoinCourseDetail {
  const totalDocuments = components.filter(
    (component) => component.component_type === "document",
  ).length;
  const totalExams = components.filter(
    (component) => component.component_type === "exam",
  ).length;
  const estimatedTotalMinutes = components.reduce(
    (total, component) => total + component.estimated_minutes,
    0,
  );

  return {
    course: {
      ...course,
      ...buildCourseLabelData(course),
    },
    modules: [...modules].sort(
      (left, right) => left.module_sequence - right.module_sequence,
    ),
    components: [...components].sort((left, right) => {
      if (left.module_id !== right.module_id) {
        return left.module_id - right.module_id;
      }
      return left.component_sequence - right.component_sequence;
    }),
    is_enrolled: Boolean(progress),
    progress_percentage: calculateProgressPercentage(course, progress),
    total_documents: totalDocuments,
    total_exams: totalExams,
    estimated_total_minutes: estimatedTotalMinutes,
  };
}

export async function getStudentJoinCourseDetail(
  courseId: number,
  userId: number,
): Promise<StudentJoinCourseDetail> {
  if (USE_MOCK_JOIN_COURSE_DATA) {
    const course = mockCourses.find((item) => item.id === courseId);
    if (!course || !course.is_active || !course.is_public) {
      throw new Error("Không tìm thấy khóa học công khai phù hợp.");
    }

    const modules = mockModules.filter((module) => module.course_id === courseId);
    const components = mockComponents.filter(
      (component) => component.course_id === courseId,
    );
    const progress = mockCourseProgresses.find(
      (item) => item.course_id === courseId && item.user_id === userId,
    );

    return Promise.resolve(
      buildJoinCourseDetail(course, modules, components, progress),
    );
  }

  const [course, categories, users, modules, components, courseProgresses] =
    await Promise.all([
      getJson<FastAPICourse>(endpoints.courseById(courseId)),
      getJsonOrFallback<FastApiCategory[]>(endpoints.categoryList(), []),
      getJsonOrFallback<FastApiUser[]>(endpoints.userList(), []),
      getJsonOrFallback<JoinCourseModule[]>(endpoints.modulesByCourse(courseId), []),
      getJsonOrFallback<JoinCourseComponent[]>(
        endpoints.componentsByCourse(courseId),
        [],
      ),
      getJsonOrFallback<JoinCourseCourseProgress[]>(
        endpoints.courseProgressByUser(userId),
        [],
      ),
    ]);

  if (!course.is_active || !course.is_public) {
    throw new Error("Khóa học này hiện chưa được công bố hoặc chưa kích hoạt.");
  }

  const progress = courseProgresses.find((item) => item.course_id === courseId);
  const instructor = users.find((user) => user.id === course.instructor_id);
  const labeledCourse = {
    ...course,
    category_name:
      categories.find((category) => category.id === course.category_id)?.name ??
      "Chưa phân loại",
    instructor_name: instructor?.username ?? "Chưa cập nhật",
    instructor_email: instructor?.email ?? "",
  };

  const detail = buildJoinCourseDetail(course, modules, components, progress);

  return {
    ...detail,
    course: labeledCourse,
  };
}

export async function joinCourseForStudent(params: {
  courseId: number;
  userId: number;
}): Promise<JoinCourseResult> {
  const detail = await getStudentJoinCourseDetail(params.courseId, params.userId);

  if (detail.is_enrolled) {
    throw new Error("Bạn đã đăng ký khóa học này rồi.");
  }

  if (USE_MOCK_JOIN_COURSE_DATA) {
    const courseProgress: JoinCourseCourseProgress = {
      course_id: params.courseId,
      user_id: params.userId,
      module_completed: 0,
      is_complete: false,
      final_score: 0,
      completed_at: null,
    };
    const moduleProgresses = detail.modules.map((module) => ({
      course_id: params.courseId,
      module_id: module.id,
      user_id: params.userId,
      components_completed: 0,
      is_complete: false,
      completed_at: null,
    }));
    const componentProgresses = detail.components.map((component, index) => ({
      id: mockComponentProgresses.length + index + 1,
      user_id: params.userId,
      course_id: params.courseId,
      module_id: component.module_id,
      course_component_id: component.id,
      is_completed: false,
      completed_at: null,
    }));

    mockCourseProgresses = [...mockCourseProgresses, courseProgress];
    mockModuleProgresses = [...mockModuleProgresses, ...moduleProgresses];
    mockComponentProgresses = [...mockComponentProgresses, ...componentProgresses];

    return Promise.resolve({
      courseProgress,
      moduleProgresses,
      componentProgresses,
    });
  }

  const courseProgress = await postJson<JoinCourseCourseProgress>(
    endpoints.createCourseProgress(),
    {
      course_id: params.courseId,
      user_id: params.userId,
      module_completed: 0,
      is_complete: false,
      final_score: 0,
      completed_at: null,
    },
  );

  const moduleProgresses = await Promise.all(
    detail.modules.map((module) =>
      postJson<JoinCourseModuleProgress>(endpoints.createModuleProgress(), {
        course_id: params.courseId,
        module_id: module.id,
        user_id: params.userId,
        components_completed: 0,
        is_complete: false,
        completed_at: null,
      }),
    ),
  );

  const componentProgresses = await Promise.all(
    detail.components.map((component) =>
      postJson<JoinCourseComponentProgress>(endpoints.createComponentProgress(), {
        user_id: params.userId,
        course_id: params.courseId,
        module_id: component.module_id,
        course_component_id: component.id,
        is_completed: false,
        completed_at: null,
      }),
    ),
  );

  return {
    courseProgress,
    moduleProgresses,
    componentProgresses,
  };
}

export async function updateCourseTotalStudent(courseId: number, newTotal: number): Promise<void> {
  if (USE_MOCK_JOIN_COURSE_DATA) {
    mockCourses.forEach((course) => {
      if (course.id === courseId) {
        course.total_student = newTotal;
      }
    });
    return Promise.resolve();
  }

  return Promise.resolve(await putJson(endpoints.updateCourse(courseId), {
    total_student: newTotal,
  }));
}
