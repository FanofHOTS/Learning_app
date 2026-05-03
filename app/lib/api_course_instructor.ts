import type { FastAPICourse } from "./api_course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_INSTRUCTOR_COURSE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_INSTRUCTOR_COURSE_DATA !== "false";

export type CourseCategoryOption = {
  id: number;
  name: string;
  description: string;
};

export type InstructorCourse = FastAPICourse & {
  category_name: string;
  instructor_name: string;
  updated_at_text: string;
};

export type InstructorCourseFilterState = {
  keyword: string;
  categoryId: string;
  isPublic: string;
  isActive: string;
  level: string;
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  coursesByInstructor: (instructorId: number) =>
    `${API_BASE_URL}/course/instructor/${instructorId}`,
  categories: () => `${API_BASE_URL}/category/`,
  profiles: () => `${API_BASE_URL}/profile/`,
};

const mockCategories: CourseCategoryOption[] = [
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

const mockInstructorCourses: InstructorCourse[] = [
  {
    id: 101,
    title: "Xây dựng ứng dụng học tập với Next.js",
    category_id: 1,
    category_name: "Lập trình web",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Tạo giao diện học trực tuyến với Next.js và Tailwind CSS.",
    description:
      "Khóa học hướng dẫn thiết kế và triển khai giao diện học tập cho học sinh và giảng viên.",
    level: "Trung cấp",
    total_module: 6,
    total_student: 120,
    image: "/logo.png",
    is_active: true,
    is_public: true,
    updated_at_text: "Cập nhật 2 ngày trước",
  },
  {
    id: 102,
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
    id: 103,
    title: "Phân tích dữ liệu học tập cho giảng viên",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Đọc tiến độ học tập và xác định điểm nghẽn của học sinh.",
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
    id: 104,
    title: "Quản trị khóa học trực tuyến quy mô lớn",
    category_id: 1,
    category_name: "Lập trình web",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Quản lý cấu trúc khóa học, module và phân quyền vận hành.",
    description:
      "Khóa học phục vụ giảng viên cần tổ chức nhiều khóa học và cập nhật nội dung thường xuyên.",
    level: "Trung cấp",
    total_module: 8,
    total_student: 234,
    image: "/logo.png",
    is_active: true,
    is_public: true,
    updated_at_text: "Cập nhật 5 ngày trước",
  },
];

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

export async function getInstructorCourseCategories(): Promise<
  CourseCategoryOption[]
> {
  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    return Promise.resolve(mockCategories);
  }

  return getJson<CourseCategoryOption[]>(endpoints.categories());
}

export async function getInstructorCourseList(
  instructorId: number,
): Promise<InstructorCourse[]> {
  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    return Promise.resolve(
      mockInstructorCourses.filter(
        (course) => course.instructor_id === instructorId,
      ),
    );
  }

  const [courses, categories] = await Promise.all([
    getJson<FastAPICourse[]>(endpoints.coursesByInstructor(instructorId)),
    getInstructorCourseCategories(),
  ]);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return courses.map((course) => ({
    ...course,
    category_name:
      categoryMap.get(course.category_id)?.name ?? `Phân loại #${course.category_id}`,
    //instructor_name: course.instructor_name ?? `Giảng viên #${course.instructor_id}`,
    instructor_name: `Giảng viên #${course.instructor_id}`,
    updated_at_text: "Đã đồng bộ từ FastAPI",
  }));
}

export function filterInstructorCourses(
  courses: InstructorCourse[],
  filters: InstructorCourseFilterState,
): InstructorCourse[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return courses.filter((course) => {
    const matchesKeyword =
      keyword.length === 0 ||
      course.title.toLowerCase().includes(keyword) ||
      course.introduction.toLowerCase().includes(keyword) ||
      course.description.toLowerCase().includes(keyword);

    const matchesCategory =
      filters.categoryId === "all" ||
      `${course.category_id}` === filters.categoryId;

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

export function getInstructorCourseLevels(courses: InstructorCourse[]): string[] {
  return Array.from(new Set(courses.map((course) => course.level)));
}
