const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_COURSE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type FastAPICourse = {
  id: number;
  title: string;
  category_id: number;
  instructor_id: number;
  introduction: string;
  description: string;
  level: string;
  total_module: number;
  total_student: number;
  image: string;
  is_active: boolean;
  is_public: boolean;
};

export type Course = {
  id: number;
  title: string;
  category_name: string;
  instructor_name: string;
  introduction: string;
  description: string;
  level: string;
  total_module: number;
  total_student: number;
  image: string;
  is_active: boolean;
  is_public: boolean;
};

export type CourseFull = {
  id: number;
  title: string;
  category_id: number;
  instructor_id: number;
  category_name: string;
  instructor_name: string;
  introduction: string;
  description: string;
  level: string;
  total_module: number;
  total_student: number;
  image: string;
  is_active: boolean;
  is_public: boolean;
};

export type CategoryOption = {
  id: number;
  name: string;
};

export type StudentCourseProgress = {
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
};

export type StudentPublicCourse = CourseFull & {
  is_enrolled: boolean;
  enrollment_status_label: string;
  progress_percentage: number;
  module_completed: number;
  final_score: number | null;
};

export type StudentPublicCourseCatalog = {
  categories: CategoryOption[];
  courses: StudentPublicCourse[];
  levels: string[];
};

export type StudentPublicCourseFilterState = {
  keyword: string;
  categoryId: string;
  enrollment: "all" | "enrolled" | "not_enrolled";
  level: string;
};

type FastApiError = {
  detail?: string;
};

type FastApiCategory = {
  id: number;
  name: string;
  description?: string;
};

const endpoints = {
  courseList: () => `${API_BASE_URL}/course/`,
  categoryList: () => `${API_BASE_URL}/category/`,
  userList: () => `${API_BASE_URL}/user/`,
  courseProgressByUserId: (userId: number) =>
    `${API_BASE_URL}/course_progress/user/${userId}`,
};

const mockCategories: CategoryOption[] = [
  { id: 1, name: "Hướng dẫn sử dụng trang web" },
  { id: 2, name: "Lập trình" },
  { id: 3, name: "Toán học" },
  { id: 4, name: "Dữ liệu" },
];

const mockUsers = [
  { id: 2, username: "Võ Thiên Sơn", role: "admin" },
  { id: 3, username: "Trần Thị Ngọc Sanh", role: "instructor" },
  { id: 4, username: "Nguyễn Thị Văn Sơn", role: "instructor" },
  { id: 5, username: "Võ Thăng Tiến", role: "instructor" },
  { id: 6, username: "Trần Thị Ngọc Nhung", role: "instructor" },
  { id: 7, username: "Nguyễn Thiên Long", role: "instructor" },
];

const mockCourseFastAPI: FastAPICourse[] = [
  {
    id: 1,
    title: "Nền tảng xây dựng ứng dụng học tập với AI",
    category_id: 1,
    instructor_id: 2,
    introduction:
      "Khóa học giúp học sinh học trực tuyến theo module và thành phần.",
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
    id: 3,
    title: "Cơ sở toán trong CNTT",
    category_id: 3,
    instructor_id: 3,
    introduction:
      "Khóa học sẽ dạy về những kiến thức toán được ứng dụng rộng rãi trong CNTT.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Cơ bản",
    total_module: 7,
    total_student: 125,
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
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Trung cấp",
    total_module: 5,
    total_student: 115,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 5,
    title: "Sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm",
    category_id: 1,
    instructor_id: 2,
    introduction:
      "Khóa học giúp học sinh sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm trên trang web.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Cơ bản",
    total_module: 3,
    total_student: 35,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 6,
    title: "Lập trình bằng Python",
    category_id: 2,
    instructor_id: 5,
    introduction:
      "Khóa học sẽ hướng dẫn việc lập trình cơ bản qua ngôn ngữ Python.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Cơ bản",
    total_module: 7,
    total_student: 122,
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
      "Khóa học sẽ dạy về cơ sở dữ liệu và những khái niệm liên quan, cũng như là cách sử dụng SQL Server ở mức cơ bản.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Trung cấp",
    total_module: 7,
    total_student: 102,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 8,
    title: "Lập trình hướng đối tượng",
    category_id: 2,
    instructor_id: 7,
    introduction:
      "Khóa học sẽ dạy về lập trình hướng đối tượng và những khái niệm liên quan thông qua C++.",
    description:
      "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
    level: "Nâng cao",
    total_module: 7,
    total_student: 113,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 9,
    title: "Mô hình hóa dữ liệu thực hành",
    category_id: 4,
    instructor_id: 6,
    introduction:
      "Khóa học hướng dẫn mô hình hóa dữ liệu cho các bài toán quản lý học tập.",
    description:
      "Học sinh sẽ luyện thiết kế lược đồ dữ liệu và đọc các tình huống triển khai thực tế.",
    level: "Nâng cao",
    total_module: 4,
    total_student: 48,
    image: "/logo.png",
    is_active: false,
    is_public: true,
  },
];

const mockCourseProgresses: StudentCourseProgress[] = [
  {
    course_id: 1,
    user_id: 1,
    module_completed: 2,
    is_complete: false,
    final_score: 82,
  },
  {
    course_id: 4,
    user_id: 1,
    module_completed: 5,
    is_complete: true,
    final_score: 91,
  },
  {
    course_id: 7,
    user_id: 1,
    module_completed: 3,
    is_complete: false,
    final_score: 77,
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

function enrichCourseData(
  courses: FastAPICourse[],
  categories: CategoryOption[],
  users: Array<{ id: number; username: string }>,
): CourseFull[] {
  return courses.map((course) => ({
    ...course,
    category_name:
      categories.find((category) => category.id === course.category_id)?.name ??
      "Chưa phân loại",
    instructor_name:
      users.find((user) => user.id === course.instructor_id)?.username ??
      "Chưa cập nhật",
  }));
}

function createStudentPublicCourses(
  courses: CourseFull[],
  courseProgresses: StudentCourseProgress[],
): StudentPublicCourse[] {
  const progressMap = new Map(
    courseProgresses.map((progress) => [progress.course_id, progress]),
  );

  return courses
    .filter((course) => course.is_active && course.is_public)
    .map((course) => {
      const progress = progressMap.get(course.id);
      const moduleCompleted = progress?.module_completed ?? 0;
      const progressPercentage =
        course.total_module > 0
          ? Math.min(
              100,
              Math.round((moduleCompleted / course.total_module) * 100),
            )
          : 0;

      return {
        ...course,
        is_enrolled: Boolean(progress),
        enrollment_status_label: progress ? "Đã đăng ký" : "Chưa đăng ký",
        progress_percentage: progressPercentage,
        module_completed: moduleCompleted,
        final_score: progress ? progress.final_score : null,
      };
    });
}

function toCourse(course: CourseFull): Course {
  return {
    id: course.id,
    title: course.title,
    category_name: course.category_name,
    instructor_name: course.instructor_name,
    introduction: course.introduction,
    description: course.description,
    level: course.level,
    total_module: course.total_module,
    total_student: course.total_student,
    image: course.image,
    is_active: course.is_active,
    is_public: course.is_public,
  };
}

export function filterStudentPublicCourses(
  courses: StudentPublicCourse[],
  filters: StudentPublicCourseFilterState,
): StudentPublicCourse[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return courses.filter((course) => {
    const matchesKeyword =
      keyword.length === 0 ||
      course.title.toLowerCase().includes(keyword) ||
      course.introduction.toLowerCase().includes(keyword) ||
      course.description.toLowerCase().includes(keyword) ||
      course.category_name.toLowerCase().includes(keyword) ||
      course.instructor_name.toLowerCase().includes(keyword);

    const matchesEnrollment =
      filters.enrollment === "all" ||
      (filters.enrollment === "enrolled" && course.is_enrolled) ||
      (filters.enrollment === "not_enrolled" && !course.is_enrolled);

    const matchesCategory =
      filters.categoryId === "all" ||
      `${course.category_id}` === filters.categoryId;

    const matchesLevel =
      filters.level === "all" || course.level === filters.level;

    return (
      matchesKeyword && matchesEnrollment && matchesCategory && matchesLevel
    );
  });
}

export function getStudentPublicCourseLevels(
  courses: StudentPublicCourse[],
): string[] {
  return Array.from(new Set(courses.map((course) => course.level)));
}

export async function getCourseListFastAPI(): Promise<FastAPICourse[]> {
  if (USE_MOCK_COURSE_DATA) {
    return Promise.resolve([...mockCourseFastAPI]);
  }

  return getJson<FastAPICourse[]>(endpoints.courseList());
}

export async function getCourseList(): Promise<Course[]> {
  if (USE_MOCK_COURSE_DATA) {
    const enrichedCourses = enrichCourseData(
      mockCourseFastAPI,
      mockCategories,
      mockUsers,
    );

    return Promise.resolve(
      enrichedCourses.map((course) => toCourse(course)),
    );
  }

  const [courses, categories, users] = await Promise.all([
    getJson<FastAPICourse[]>(endpoints.courseList()),
    getJson<FastApiCategory[]>(endpoints.categoryList()),
    getJson<Array<{ id: number; username: string }>>(endpoints.userList()),
  ]);

  const enrichedCourses = enrichCourseData(
    courses,
    categories.map((category) => ({ id: category.id, name: category.name })),
    users,
  );

  return enrichedCourses.map((course) => toCourse(course));
}

export async function getStudentPublicCourseCatalog(
  userId: number,
): Promise<StudentPublicCourseCatalog> {
  if (USE_MOCK_COURSE_DATA) {
    const enrichedCourses = enrichCourseData(
      mockCourseFastAPI,
      mockCategories,
      mockUsers,
    );
    const publicCourses = createStudentPublicCourses(
      enrichedCourses,
      mockCourseProgresses.filter((progress) => progress.user_id === userId),
    );

    return Promise.resolve({
      categories: [...mockCategories],
      courses: publicCourses,
      levels: getStudentPublicCourseLevels(publicCourses),
    });
  }

  const [courses, categories, users, courseProgresses] = await Promise.all([
    getJson<FastAPICourse[]>(endpoints.courseList()),
    getJson<FastApiCategory[]>(endpoints.categoryList()),
    getJson<Array<{ id: number; username: string }>>(endpoints.userList()),
    getJsonOrFallback<StudentCourseProgress[]>(
      endpoints.courseProgressByUserId(userId),
      [],
    ),
  ]);

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  const enrichedCourses = enrichCourseData(courses, categoryOptions, users);
  const publicCourses = createStudentPublicCourses(
    enrichedCourses,
    courseProgresses,
  );

  return {
    categories: categoryOptions,
    courses: publicCourses,
    levels: getStudentPublicCourseLevels(publicCourses),
  };
}
