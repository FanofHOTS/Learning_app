import type { FastAPICourse } from "./api_course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_INSTRUCTOR_COURSE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

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

export type InstructorCourseModule = {
  id: number;
  course_id: number;
  title: string;
  module_sequence: number;
  type: string;
  introduction: string;
  total_component: number;
};

export type InstructorCourseComponent = {
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

export type InstructorCourseDetail = InstructorCourse & {
  modules: InstructorCourseModule[];
  components: InstructorCourseComponent[];
};

export type InstructorCourseUpdateInput = {
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

export type UploadCourseImageResponse = {
  file_url: string;
};

export type DeleteOldUploadResponse = {
  message: string;
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  coursesByInstructor: (instructorId: number) =>
    `${API_BASE_URL}/course/instructor/${instructorId}`,
  courseById: (courseId: number) => `${API_BASE_URL}/course/${courseId}`,
  updateCourse: (courseId: number) => `${API_BASE_URL}/course/update/${courseId}`,
  categories: () => `${API_BASE_URL}/category/`,
  modulesByCourse: (courseId: number) => `${API_BASE_URL}/module/course/${courseId}`,
  componentsByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_component/course/${courseId}`,
  uploadCourseImage: () => `${API_BASE_URL}/document/upload`,
  deleteOldUpload: (fileUrl: string) =>
    `${API_BASE_URL}/document/delete_upload?file_url=${encodeURIComponent(fileUrl)}`,
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
    id: 1,
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
    id: 4,
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

const mockModulesByCourse: Record<number, InstructorCourseModule[]> = {
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
};

const mockComponentsByCourse: Record<number, InstructorCourseComponent[]> = {
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
        "Trình bày bức tranh tổng quan của khóa học, mục tiêu đầu ra và các mốc cần hoàn thành.",
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
        "Giải thích cấu trúc thư mục, cách phân chia route và quản lý tài nguyên dùng chung.",
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
        "Bài kiểm tra ngắn giúp học sinh tự xác nhận kiến thức trước khi sang phần giao diện.",
      estimated_minutes: 15,
      is_preview: false,
    },
    {
      id: 1004,
      course_id: 1,
      module_id: 102,
      title: "Tài liệu: Thiết kế trải nghiệm học sinh",
      component_sequence: 1,
      component_type: "document",
      ref_id: 303,
      summary:
        "Tập trung vào cách thiết kế bố cục học tập rõ ràng, theo tiến trình và dễ theo dõi.",
      estimated_minutes: 20,
      is_preview: false,
    },
    {
      id: 1005,
      course_id: 1,
      module_id: 102,
      title: "Tài liệu: Thiết kế trải nghiệm giảng viên",
      component_sequence: 2,
      component_type: "document",
      ref_id: 304,
      summary:
        "Mô tả các khu vực quản trị khóa học, bộ lọc nội dung và hành động cập nhật cần thiết.",
      estimated_minutes: 16,
      is_preview: false,
    },
    {
      id: 1006,
      course_id: 1,
      module_id: 102,
      title: "Bài kiểm tra: Thực hành dựng trang chi tiết",
      component_sequence: 3,
      component_type: "exam",
      ref_id: 2,
      summary:
        "Đánh giá khả năng đọc dữ liệu module và biểu diễn đúng thông tin chi tiết trên giao diện.",
      estimated_minutes: 25,
      is_preview: false,
    },
    {
      id: 1007,
      course_id: 1,
      module_id: 103,
      title: "Tài liệu: Đồng bộ giao diện với FastAPI",
      component_sequence: 1,
      component_type: "document",
      ref_id: 305,
      summary:
        "Kết nối route course, module, course_component và chuẩn bị payload cập nhật trạng thái khóa học.",
      estimated_minutes: 22,
      is_preview: false,
    },
    {
      id: 1008,
      course_id: 1,
      module_id: 103,
      title: "Bài kiểm tra: Kiểm tra tích hợp cuối phần",
      component_sequence: 2,
      component_type: "exam",
      ref_id: 3,
      summary:
        "Bài kiểm tra tổng hợp để xác nhận toàn bộ luồng chi tiết khóa học đã được hiểu đúng.",
      estimated_minutes: 30,
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
        "Hướng dẫn cách chuyển nội dung bài giảng thành các mục tiêu đánh giá đo lường được.",
      estimated_minutes: 14,
      is_preview: true,
    },
    {
      id: 2002,
      course_id: 2,
      module_id: 201,
      title: "Bài kiểm tra: Chọn loại câu hỏi phù hợp",
      component_sequence: 2,
      component_type: "exam",
      ref_id: 4,
      summary:
        "Giúp học sinh phân biệt trường hợp nên dùng trắc nghiệm, tự luận hay câu hỏi kết hợp.",
      estimated_minutes: 18,
      is_preview: false,
    },
    {
      id: 2003,
      course_id: 2,
      module_id: 202,
      title: "Tài liệu: Tiêu chí kiểm định chất lượng câu hỏi",
      component_sequence: 1,
      component_type: "document",
      ref_id: 402,
      summary:
        "Tổng hợp các tiêu chí về độ rõ ràng, tính chính xác và khả năng phân loại người học.",
      estimated_minutes: 17,
      is_preview: false,
    },
    {
      id: 2004,
      course_id: 2,
      module_id: 202,
      title: "Bài kiểm tra: Đánh giá bộ câu hỏi mẫu",
      component_sequence: 2,
      component_type: "exam",
      ref_id: 5,
      summary:
        "Bài đánh giá dùng để thực hành phản biện và chỉnh sửa một bộ câu hỏi do AI tạo ra.",
      estimated_minutes: 24,
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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

function getExtension(fileNameOrUrl: string): string {
  const normalized = fileNameOrUrl.toLowerCase().split("?")[0];
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return normalized.slice(lastDot);
}

function cloneModules(courseId: number): InstructorCourseModule[] {
  return (mockModulesByCourse[courseId] ?? []).map((module) => ({ ...module }));
}

function cloneComponents(courseId: number): InstructorCourseComponent[] {
  return (mockComponentsByCourse[courseId] ?? []).map((component) => ({
    ...component,
  }));
}

export function validateCourseImageFile(fileNameOrUrl: string): string | null {
  const extension = getExtension(fileNameOrUrl);
  if (!extension) {
    return "Không xác định được định dạng của hình tải lên.";
  }

  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return "Hình đại diện chỉ chấp nhận tệp .png, .jpg, .jpeg hoặc .webp.";
  }

  return null;
}

export function shouldDeleteUploadedCourseImage(fileUrl: string): boolean {
  return fileUrl.startsWith("/uploads/");
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

  const categoryMap = new Map(
    categories.map((category) => [category.id, category]),
  );

  return courses.map((course) => ({
    ...course,
    category_name:
      categoryMap.get(course.category_id)?.name ??
      `Phân loại #${course.category_id}`,
    instructor_name: `Giảng viên #${course.instructor_id}`,
    updated_at_text: "Đã đồng bộ từ FastAPI",
  }));
}

export async function getInstructorCourseListRaw(
  instructorId: number,
): Promise<FastAPICourse[]> {
  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    return Promise.resolve(
      mockInstructorCourses.filter(
        (course) => course.instructor_id === instructorId,
      ),
    );
  }

  return getJson<FastAPICourse[]>(endpoints.coursesByInstructor(instructorId));
}

export async function getInstructorCourseDetail(
  courseId: number,
): Promise<InstructorCourseDetail> {
  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    const course =
      mockInstructorCourses.find((item) => item.id === courseId) ??
      mockInstructorCourses[0];

    return Promise.resolve({
      ...course,
      id: courseId,
      modules: cloneModules(course.id),
      components: cloneComponents(course.id),
    });
  }

  const [course, categories, modules, components] = await Promise.all([
    getJson<FastAPICourse>(endpoints.courseById(courseId)),
    getInstructorCourseCategories(),
    getJson<InstructorCourseModule[]>(endpoints.modulesByCourse(courseId)).catch(
      () => [],
    ),
    getJson<InstructorCourseComponent[]>(
      endpoints.componentsByCourse(courseId),
    ).catch(() => []),
  ]);

  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return {
    ...course,
    category_name:
      categoryMap.get(course.category_id) ?? `Phân loại #${course.category_id}`,
    instructor_name: `Giảng viên #${course.instructor_id}`,
    updated_at_text: "Đã đồng bộ từ FastAPI",
    modules,
    components,
  };
}

export async function updateInstructorCourse(
  courseId: number,
  payload: InstructorCourseUpdateInput,
): Promise<FastAPICourse> {
  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    const index = mockInstructorCourses.findIndex((course) => course.id === courseId);
    if (index === -1) {
      throw new Error("Không tìm thấy khóa học để cập nhật.");
    }

    mockInstructorCourses[index] = {
      ...mockInstructorCourses[index],
      ...payload,
      id: courseId,
      category_name:
        mockCategories.find((category) => category.id === payload.category_id)?.name ??
        `Phân loại #${payload.category_id}`,
      updated_at_text: "Vừa cập nhật xong",
    };

    const updatedCourse = mockInstructorCourses[index];

    return Promise.resolve({
      id: updatedCourse.id,
      title: updatedCourse.title,
      category_id: updatedCourse.category_id,
      instructor_id: updatedCourse.instructor_id,
      introduction: updatedCourse.introduction,
      description: updatedCourse.description,
      level: updatedCourse.level,
      total_module: updatedCourse.total_module,
      total_student: updatedCourse.total_student,
      image: updatedCourse.image,
      is_active: updatedCourse.is_active,
      is_public: updatedCourse.is_public,
    });
  }

  return putJson<FastAPICourse>(endpoints.updateCourse(courseId), payload);
}

export async function uploadInstructorCourseImage(
  file: File,
): Promise<UploadCourseImageResponse> {
  const validationMessage = validateCourseImageFile(file.name);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    return Promise.resolve({
      //file_url: `/uploads/${Date.now()}-${file.name}`,
      file_url: `/uploads/${file.name}`,
    });
  }

  const form = new FormData();
  form.append("file", file);
  form.append("document_type", "other");

  return fetchJson<UploadCourseImageResponse>(endpoints.uploadCourseImage(), {
    method: "POST",
    body: form,
  });
}

export async function deleteOldInstructorCourseImage(
  fileUrl: string,
): Promise<DeleteOldUploadResponse> {
  if (USE_MOCK_INSTRUCTOR_COURSE_DATA) {
    return Promise.resolve({
      message: "Hình cũ đã được xóa thành công.",
    });
  }

  return fetchJson<DeleteOldUploadResponse>(endpoints.deleteOldUpload(fileUrl), {
    method: "POST",
  });
}

export function validateInstructorCourseUpdate(
  payload: InstructorCourseUpdateInput,
): string {
  if (!payload.title.trim()) {
    return "Tên khóa học không được để trống.";
  }

  if (!payload.introduction.trim()) {
    return "Giới thiệu khóa học không được để trống.";
  }

  if (!payload.description.trim()) {
    return "Mô tả khóa học không được để trống.";
  }

  if (!payload.level.trim()) {
    return "Trình độ khóa học không được để trống.";
  }

  if (!payload.image.trim()) {
    return "Hình đại diện khóa học không được để trống.";
  }

  if (!Number.isInteger(payload.category_id) || payload.category_id <= 0) {
    return "Phân loại khóa học không hợp lệ.";
  }

  if (!Number.isInteger(payload.instructor_id) || payload.instructor_id <= 0) {
    return "Giảng viên phụ trách không hợp lệ.";
  }

  if (!Number.isFinite(payload.total_module) || payload.total_module <= 0) {
    return "Tổng số module phải lớn hơn 0.";
  }

  if (!Number.isFinite(payload.total_student) || payload.total_student < 0) {
    return "Tổng số học sinh không được nhỏ hơn 0.";
  }

  return "";
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
