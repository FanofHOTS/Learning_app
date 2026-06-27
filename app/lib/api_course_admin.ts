import type { FastAPICourse } from "./api_course";
import type { User } from "./api_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_ADMIN_COURSE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type AdminCourseCategoryOption = {
  id: number;
  name: string;
  description: string;
};

export type AdminCourse = FastAPICourse & {
  category_name: string;
  instructor_name: string;
  instructor_email?: string;
  updated_at_text: string;
};

export type AdminCourseFilterState = {
  keyword: string;
  categoryId: string;
  isPublic: string;
  isActive: string;
  level: string;
};

export type AdminCourseModule = {
  id: number;
  course_id: number;
  title: string;
  module_sequence: number;
  type: string;
  introduction: string;
  total_component: number;
};

export type AdminCourseComponent = {
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

export type AdminCourseDetail = AdminCourse & {
  modules: AdminCourseModule[];
  components: AdminCourseComponent[];
};

export type AdminCourseStudentStatus = {
  user_id: number;
  username: string;
  email: string;
  is_complete: boolean;
  final_score: number | null;
  completed_at: string | null;
  module_completed: number;
  has_certificate: boolean;
  certificate_code: string | null;
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  courses: () => `${API_BASE_URL}/course/`,
  courseById: (courseId: number) => `${API_BASE_URL}/course/${courseId}`,
  categories: () => `${API_BASE_URL}/category/`,
  modulesByCourse: (courseId: number) => `${API_BASE_URL}/module/course/${courseId}`,
  componentsByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_component/course/${courseId}`,
  users: () => `${API_BASE_URL}/user/`,
  courseProgressByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_progress/course/${courseId}`,
  certificatesByCourse: (courseId: number) =>
    `${API_BASE_URL}/certificate/course/${courseId}`,
};

const mockCategories: AdminCourseCategoryOption[] = [
  {
    id: 1,
    name: "Lập trình web",
    description: "Các khóa học phát triển giao diện và hệ thống web.",
  },
  {
    id: 2,
    name: "Trí tuệ nhân tạo",
    description: "Các khóa học về AI, máy học và ứng dụng thực tế.",
  },
  {
    id: 3,
    name: "Khoa học dữ liệu",
    description: "Các khóa học về dữ liệu, trực quan hóa và phân tích.",
  },
];

const mockUsers = [
  { id: 1, username: "Nguyễn Văn An", email: "nguyenvanan@student.edu.vn" },
  { id: 2, username: "Võ Thiên Sơn", email: "vothienson@admin.edu.vn" },
  { id: 3, username: "Trần Thị Ngọc Sanh", email: "tranthingocsanh@instructor.edu.vn" },
  { id: 4, username: "Nguyễn Thị Văn Sơn", email: "nguyenthivanson@instructor.edu.vn" },
  { id: 5, username: "Võ Thăng Tiến", email: "vothangtien@instructor.edu.vn" },
  { id: 6, username: "Trần Thị Ngọc Nhung", email: "tranthingocnhung@instructor.edu.vn" },
  { id: 7, username: "Nguyễn Thiên Long", email: "nguyenthienlong@instructor.edu.vn" },
  { id: 9, username: "Lê Hoàng Minh", email: "lehoangminh@instructor.edu.vn" },
  { id: 12, username: "Trần Hải Yến", email: "tranhaiyen@instructor.edu.vn" },
];

const mockAdminCourses: AdminCourse[] = [
  {
    id: 1,
    title: "Xây dựng ứng dụng học tập với Next.js",
    category_id: 1,
    category_name: "Lập trình web",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Tạo giao diện học trực tuyến với Next.js và Tailwind CSS.",
    description:
      "Khóa học hướng dẫn thiết kế và triển khai giao diện học tập cho sinh viên và giảng viên.",
    level: "Trung cấp",
    total_module: 6,
    total_student: 120,
    image: "/logo.png",
    is_active: true,
    is_public: true,
    updated_at_text: "Cập nhật 2 ngày trước",
  },
  {
    id: 2,
    title: "Thiết kế ngân hàng câu hỏi bằng AI",
    category_id: 2,
    category_name: "Trí tuệ nhân tạo",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Tạo câu hỏi trắc nghiệm và tự luận từ nội dung học tập.",
    description:
      "Khóa học tập trung vào quy trình xây dựng bộ câu hỏi thông minh cho giảng viên.",
    level: "Nâng cao",
    total_module: 4,
    total_student: 56,
    image: "/logo.png",
    is_active: true,
    is_public: false,
    updated_at_text: "Cập nhật hôm nay",
  },
  {
    id: 3,
    title: "Phân tích dữ liệu học tập cho giảng viên",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Đọc tiến độ học tập và xác định điểm nghẽn của sinh viên.",
    description:
      "Khóa học giúp giảng viên hiểu dữ liệu học tập để điều chỉnh nội dung phù hợp hơn.",
    level: "Cơ bản",
    total_module: 5,
    total_student: 0,
    image: "/logo.png",
    is_active: false,
    is_public: false,
    updated_at_text: "Cập nhật 1 tuần trước",
  },
  {
    id: 4,
    title: "Thống kê học tập với Python",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 9,
    instructor_name: "Lê Hoàng Minh",
    introduction: "Phân tích dữ liệu lớp học bằng Python và biểu đồ trực quan.",
    description:
      "Khóa học dành cho giảng viên cần đọc dữ liệu học tập và thiết kế dashboard báo cáo.",
    level: "Trung cấp",
    total_module: 7,
    total_student: 84,
    image: "/logo.png",
    is_active: true,
    is_public: true,
    updated_at_text: "Cập nhật 3 ngày trước",
  },
  {
    id: 5,
    title: "Nền tảng học máy cho người mới bắt đầu",
    category_id: 2,
    category_name: "Trí tuệ nhân tạo",
    instructor_id: 12,
    instructor_name: "Trần Hải Yến",
    introduction: "Giải thích các khái niệm học máy theo hướng thực hành dễ tiếp cận.",
    description:
      "Khóa học giúp người học nắm khái niệm nền tảng trước khi bước vào các mô hình nâng cao.",
    level: "Cơ bản",
    total_module: 5,
    total_student: 198,
    image: "/logo.png",
    is_active: true,
    is_public: true,
    updated_at_text: "Cập nhật 5 ngày trước",
  },
];

const mockModulesByCourse: Record<number, AdminCourseModule[]> = {
  1: [
    {
      id: 101,
      course_id: 1,
      title: "Module 1: Khởi động dự án",
      module_sequence: 1,
      type: "Học liệu",
      introduction:
        "Giới thiệu lộ trình khóa học, công cụ dùng trong dự án và cách tổ chức thư mục.",
      total_component: 3,
    },
    {
      id: 102,
      course_id: 1,
      title: "Module 2: Thiết kế giao diện học tập",
      module_sequence: 2,
      type: "Thực hành",
      introduction:
        "Xây dựng màn hình danh sách, trang chi tiết và luồng tương tác cho người học.",
      total_component: 3,
    },
    {
      id: 103,
      course_id: 1,
      title: "Module 3: Kết nối dữ liệu FastAPI",
      module_sequence: 3,
      type: "Triển khai",
      introduction:
        "Chuẩn hóa API, đồng bộ dữ liệu giao diện và chuẩn bị cho phần đánh giá học tập.",
      total_component: 2,
    },
  ],
  2: [
    {
      id: 201,
      course_id: 2,
      title: "Module 1: Tổng quan về AI tạo câu hỏi",
      module_sequence: 1,
      type: "Học liệu",
      introduction:
        "Làm rõ quy trình phân tích nội dung nguồn và xác định dạng câu hỏi phù hợp.",
      total_component: 2,
    },
    {
      id: 202,
      course_id: 2,
      title: "Module 2: Kiểm định chất lượng đầu ra",
      module_sequence: 2,
      type: "Đánh giá",
      introduction:
        "Đánh giá độ rõ ràng, độ khó và độ phủ kiến thức của ngân hàng câu hỏi.",
      total_component: 2,
    },
  ],
  4: [
    {
      id: 401,
      course_id: 4,
      title: "Module 1: Chuẩn bị dữ liệu lớp học",
      module_sequence: 1,
      type: "Học liệu",
      introduction: "Dọn dẹp và chuẩn hóa dữ liệu trước khi trực quan hóa.",
      total_component: 2,
    },
    {
      id: 402,
      course_id: 4,
      title: "Module 2: Dựng dashboard thống kê",
      module_sequence: 2,
      type: "Thực hành",
      introduction: "Xây dựng biểu đồ phục vụ giảng viên và quản trị viên.",
      total_component: 3,
    },
  ],
};

const mockComponentsByCourse: Record<number, AdminCourseComponent[]> = {
  1: [
    {
      id: 1001,
      course_id: 1,
      module_id: 101,
      title: "Tài liệu: Lộ trình xây dựng nền tảng",
      component_sequence: 1,
      component_type: "document",
      ref_id: 301,
      summary:
        "Trình bày mục tiêu đầu ra và các mốc kỹ thuật cần hoàn thành trong khóa học.",
      estimated_minutes: 12,
      is_preview: true,
    },
    {
      id: 1002,
      course_id: 1,
      module_id: 101,
      title: "Tài liệu: Tổ chức thư mục App Router",
      component_sequence: 2,
      component_type: "document",
      ref_id: 302,
      summary:
        "Giải thích cách chia route, thành phần dùng chung và helper dữ liệu.",
      estimated_minutes: 18,
      is_preview: false,
    },
    {
      id: 1003,
      course_id: 1,
      module_id: 101,
      title: "Bài kiểm tra: Kiến thức nền tảng Next.js",
      component_sequence: 3,
      component_type: "exam",
      ref_id: 1,
      summary:
        "Bài kiểm tra ngắn để xác nhận người học nắm phần nền tảng của khóa học.",
      estimated_minutes: 15,
      is_preview: false,
    },
  ],
  2: [
    {
      id: 2001,
      course_id: 2,
      module_id: 201,
      title: "Tài liệu: Phân rã nội dung thành mục tiêu đánh giá",
      component_sequence: 1,
      component_type: "document",
      ref_id: 401,
      summary:
        "Mô tả cách tách nội dung gốc thành các nhóm kỹ năng và tiêu chí đánh giá.",
      estimated_minutes: 16,
      is_preview: true,
    },
    {
      id: 2002,
      course_id: 2,
      module_id: 201,
      title: "Bài kiểm tra: Kiểm định prompt tạo câu hỏi",
      component_sequence: 2,
      component_type: "exam",
      ref_id: 4,
      summary:
        "Giúp giảng viên đánh giá tính ổn định của prompt tạo câu hỏi theo đầu ra mong muốn.",
      estimated_minutes: 22,
      is_preview: false,
    },
  ],
  4: [
    {
      id: 4001,
      course_id: 4,
      module_id: 401,
      title: "Tài liệu: Chuẩn hóa bảng điểm",
      component_sequence: 1,
      component_type: "document",
      ref_id: 501,
      summary: "Làm sạch dữ liệu điểm danh, điểm số và tiến độ học tập.",
      estimated_minutes: 14,
      is_preview: true,
    },
    {
      id: 4002,
      course_id: 4,
      module_id: 402,
      title: "Tài liệu: Biểu đồ cho quản trị viên",
      component_sequence: 1,
      component_type: "document",
      ref_id: 502,
      summary: "Tạo các chỉ số giúp quản trị viên nhìn được sức khỏe hệ thống khóa học.",
      estimated_minutes: 20,
      is_preview: false,
    },
  ],
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse để dùng thông báo mặc định.
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

export async function getAdminCourseCategories(): Promise<
  AdminCourseCategoryOption[]
> {
  if (USE_MOCK_ADMIN_COURSE_DATA) {
    return Promise.resolve(mockCategories);
  }

  return getJson<AdminCourseCategoryOption[]>(endpoints.categories());
}

const mockCourseProgresses: Record<number, Array<{
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number | null;
  completed_at: string | null;
}>> = {
  1: [
    {
      course_id: 1,
      user_id: 1,
      module_completed: 3,
      is_complete: true,
      final_score: 85,
      completed_at: "2026-05-20T08:00:00.000Z",
    },
    {
      course_id: 1,
      user_id: 3,
      module_completed: 2,
      is_complete: false,
      final_score: null,
      completed_at: null,
    },
  ],
  4: [
    {
      course_id: 4,
      user_id: 1,
      module_completed: 2,
      is_complete: true,
      final_score: 92,
      completed_at: "2026-06-15T08:00:00.000Z",
    },
  ],
};

const mockCertificateRecords: Record<number, Array<{
  user_id: number;
  certificate_code: string;
}>> = {
  1: [
    {
      user_id: 1,
      certificate_code: "CERT-20260420-101-1-A3F8C2",
    },
  ],
};

export async function getAdminCourseStudents(
  courseId: number,
): Promise<AdminCourseStudentStatus[]> {
  if (USE_MOCK_ADMIN_COURSE_DATA) {
    const progresses = mockCourseProgresses[courseId] ?? [];
    const certificates = mockCertificateRecords[courseId] ?? [];
    const certificateUserIds = new Set(certificates.map((c) => c.user_id));

    return progresses.map((progress) => {
      const user = mockUsers.find((u) => u.id === progress.user_id);
      const cert = certificates.find((c) => c.user_id === progress.user_id);
      return {
        user_id: progress.user_id,
        username: user?.username ?? `Sinh viên #${progress.user_id}`,
        email: user?.email ?? "",
        is_complete: progress.is_complete,
        final_score: progress.final_score,
        completed_at: progress.completed_at,
        module_completed: progress.module_completed,
        has_certificate: certificateUserIds.has(progress.user_id),
        certificate_code: cert?.certificate_code ?? null,
      };
    });
  }

  const [progresses, certificates, users] = await Promise.all([
    getJsonOrFallback<Array<{
      course_id: number;
      user_id: number;
      module_completed: number;
      is_complete: boolean;
      final_score: number | null;
      completed_at: string | null;
    }>>(endpoints.courseProgressByCourse(courseId), []),
    getJsonOrFallback<Array<{
      user_id: number;
      certificate_code: string;
    }>>(endpoints.certificatesByCourse(courseId), []),
    getAdminUserList(),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const certificateUserIds = new Set(certificates.map((c) => c.user_id));

  return progresses.map((progress) => {
    const user = userMap.get(progress.user_id);
    const cert = certificates.find((c) => c.user_id === progress.user_id);
    return {
      user_id: progress.user_id,
      username: user?.username ?? `Sinh viên #${progress.user_id}`,
      email: user?.email ?? "",
      is_complete: progress.is_complete,
      final_score: progress.final_score,
      completed_at: progress.completed_at,
      module_completed: progress.module_completed,
      has_certificate: certificateUserIds.has(progress.user_id),
      certificate_code: cert?.certificate_code ?? null,
    };
  });
}

export async function getAdminUserList(): Promise<User[]> {
  return getJson<User[]>(endpoints.users());
}

export async function getAdminCourseList(): Promise<AdminCourse[]> {
  if (USE_MOCK_ADMIN_COURSE_DATA) {
    return Promise.resolve(mockAdminCourses);
  }

  const [courses, categories, users] = await Promise.all([
    getJson<FastAPICourse[]>(endpoints.courses()),
    getAdminCourseCategories(),
    getAdminUserList(),
  ]);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  return courses.map((course) => ({
    ...course,
    category_name:
      categoryMap.get(course.category_id)?.name ?? `Phân loại #${course.category_id}`,
    instructor_name:
      userMap.get(course.instructor_id)?.username ?? `Giảng viên #${course.instructor_id}`,
    updated_at_text: "Đã đồng bộ từ FastAPI",
  }));
}

export async function getAdminCourseDetail(
  courseId: number,
): Promise<AdminCourseDetail & { instructor_email: string }> {
  if (USE_MOCK_ADMIN_COURSE_DATA) {
    const course = mockAdminCourses.find((item) => item.id === courseId);
    if (!course) {
      throw new Error("Không tìm thấy khóa học trên hệ thống.");
    }

    const instructor = mockUsers.find((u) => u.id === course.instructor_id);

    return {
      ...course,
      instructor_name: instructor?.username ?? `Giảng viên #${course.instructor_id}`,
      instructor_email: instructor?.email ?? "",
      modules: mockModulesByCourse[courseId] ?? [],
      components: mockComponentsByCourse[courseId] ?? [],
    };
  }

  const [course, categories, users, modules, components] = await Promise.all([
    getJson<FastAPICourse>(endpoints.courseById(courseId)),
    getAdminCourseCategories(),
    getAdminUserList(),
    getJson<AdminCourseModule[]>(endpoints.modulesByCourse(courseId)).catch(() => []),
    getJson<AdminCourseComponent[]>(endpoints.componentsByCourse(courseId)).catch(
      () => [],
    ),
  ]);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  const instructor = userMap.get(course.instructor_id);

  return {
    ...course,
    category_name:
      categoryMap.get(course.category_id)?.name ?? `Phân loại #${course.category_id}`,
    instructor_name: instructor?.username ?? `Giảng viên #${course.instructor_id}`,
    instructor_email: instructor?.email ?? "",
    updated_at_text: "Đã đồng bộ từ FastAPI",
    modules,
    components,
  };
}

export function filterAdminCourses(
  courses: AdminCourse[],
  filters: AdminCourseFilterState,
): AdminCourse[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return courses.filter((course) => {
    const matchesKeyword =
      keyword.length === 0 ||
      course.title.toLowerCase().includes(keyword) ||
      course.introduction.toLowerCase().includes(keyword) ||
      course.description.toLowerCase().includes(keyword) ||
      course.instructor_name.toLowerCase().includes(keyword);

    const matchesCategory =
      filters.categoryId === "all" || `${course.category_id}` === filters.categoryId;

    const matchesPublic =
      filters.isPublic === "all" ||
      (filters.isPublic === "public" && course.is_public) ||
      (filters.isPublic === "private" && !course.is_public);

    const matchesActive =
      filters.isActive === "all" ||
      (filters.isActive === "active" && course.is_active) ||
      (filters.isActive === "inactive" && !course.is_active);

    const matchesLevel =
      filters.level === "all" || course.level === filters.level;

    return (
      matchesKeyword &&
      matchesCategory &&
      matchesPublic &&
      matchesActive &&
      matchesLevel
    );
  });
}

export function getAdminCourseLevels(courses: AdminCourse[]): string[] {
  return Array.from(new Set(courses.map((course) => course.level)));
}
