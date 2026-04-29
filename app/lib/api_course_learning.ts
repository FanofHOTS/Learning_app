import type { FastAPICourse } from "./api_course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_COURSE_LEARNING_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_COURSE_LEARNING_DATA !== "false";

export type LearningModule = {
  id: number;
  course_id: number;
  title: string;
  module_sequence: number;
  type: string;
  introduction: string;
  total_component: number;
};

export type LearningComponent = {
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

export type LearningComponentProgress = {
  id: number;
  user_id: number;
  course_id: number;
  module_id: number;
  course_component_id: number;
  is_completed: boolean;
  completed_at: string | null;
};

export type CourseLearningData = {
  course: FastAPICourse;
  modules: LearningModule[];
  components: LearningComponent[];
  progressRecords: LearningComponentProgress[];
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  courseById: (courseId: number) => `${API_BASE_URL}/course/${courseId}`,
  modulesByCourse: (courseId: number) => `${API_BASE_URL}/module/course/${courseId}`,
  componentsByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_component/course/${courseId}`,
  progressByUserAndCourse: (userId: number, courseId: number) =>
    `${API_BASE_URL}/course_component_progress/user/${userId}/course/${courseId}`,
};

const mockCourse: FastAPICourse = {
  id: 1,
  title: "Nền tảng xây dựng ứng dụng học tập với AI",
  category_id: 1,
  instructor_id: 2,
  introduction: "Khóa học giúp học sinh học trực tuyến theo module và thành phần.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 3,
  total_student: 42,
  image: "/logo.png",
  is_active: true,
  is_public: true,
};

const mockModules: LearningModule[] = [
  {
    id: 11,
    course_id: 1,
    title: "Module 1: Làm quen với khóa học",
    module_sequence: 1,
    type: "Học liệu",
    introduction: "Nắm được mục tiêu khóa học và cách theo dõi tiến độ.",
    total_component: 2,
  },
  {
    id: 12,
    course_id: 1,
    title: "Module 2: Học qua tài liệu có hướng dẫn",
    module_sequence: 2,
    type: "Học liệu",
    introduction: "Đọc tài liệu và củng cố kiến thức qua một bài kiểm tra ngắn.",
    total_component: 3,
  },
  {
    id: 13,
    course_id: 1,
    title: "Module 3: Tổng kết và tự đánh giá",
    module_sequence: 3,
    type: "Đánh giá",
    introduction: "Ôn tập lại toàn bộ kiến thức trước khi kết thúc khóa học.",
    total_component: 2,
  },
];

const mockComponents: LearningComponent[] = [
  {
    id: 1001,
    course_id: 1,
    module_id: 11,
    title: "Tài liệu: Mục tiêu của khóa học",
    component_sequence: 1,
    component_type: "document",
    ref_id: 201,
    summary: "Đọc tổng quan về lộ trình học, cách đánh dấu hoàn thành và quy tắc mở khóa.",
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
    summary: "Bài kiểm tra ngắn để xác nhận bạn đã nắm phần giới thiệu của khóa học.",
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
    summary: "Tài liệu mô tả cách đọc nội dung, ghi chú và theo dõi tiến độ từng bước.",
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
    summary: "Danh sách kiểm tra trước khi làm bài để tránh bỏ sót phần quan trọng.",
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
    summary: "Bài kiểm tra xác nhận bạn đã đi hết các tài liệu trong module 2.",
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
    summary: "Tài liệu tóm tắt những điểm cần nhớ trước khi kết thúc khóa học.",
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
    summary: "Bài kiểm tra cuối khóa để chốt lại toàn bộ tiến độ học tập.",
    estimated_minutes: 25,
    is_preview: false,
  },
];

let mockProgressRecords: LearningComponentProgress[] = [
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

export async function getCourseLearningData(
  courseId: number,
  userId: number,
): Promise<CourseLearningData> {
  if (USE_MOCK_COURSE_LEARNING_DATA) {
    return {
      course: { ...mockCourse, id: courseId },
      modules: mockModules.map((module) => ({ ...module, course_id: courseId })),
      components: mockComponents.map((component) => ({
        ...component,
        course_id: courseId,
      })),
      progressRecords: mockProgressRecords
        .filter(
          (record) => record.course_id === courseId && record.user_id === userId,
        )
        .map((record) => ({ ...record })),
    };
  }

  const [course, modules, components, progressRecords] = await Promise.all([
    getJson<FastAPICourse>(endpoints.courseById(courseId)),
    getJson<LearningModule[]>(endpoints.modulesByCourse(courseId)),
    getJson<LearningComponent[]>(endpoints.componentsByCourse(courseId)),
    getJson<LearningComponentProgress[]>(
      endpoints.progressByUserAndCourse(userId, courseId),
    ).catch(() => []),
  ]);

  return {
    course,
    modules,
    components,
    progressRecords,
  };
}

export async function markCourseComponentCompleted(payload: {
  userId: number;
  courseId: number;
  moduleId: number;
  courseComponentId: number;
}): Promise<LearningComponentProgress> {
  if (USE_MOCK_COURSE_LEARNING_DATA) {
    const existing = mockProgressRecords.find(
      (record) =>
        record.user_id === payload.userId &&
        record.course_id === payload.courseId &&
        record.course_component_id === payload.courseComponentId,
    );

    if (existing) {
      existing.is_completed = true;
      existing.completed_at = new Date().toISOString();
      return { ...existing };
    }

    const newRecord: LearningComponentProgress = {
      id: mockProgressRecords.length + 1,
      user_id: payload.userId,
      course_id: payload.courseId,
      module_id: payload.moduleId,
      course_component_id: payload.courseComponentId,
      is_completed: true,
      completed_at: new Date().toISOString(),
    };

    mockProgressRecords = [...mockProgressRecords, newRecord];
    return { ...newRecord };
  }

  const response = await fetch(
    `${API_BASE_URL}/course_component_progress/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: payload.userId,
        course_id: payload.courseId,
        module_id: payload.moduleId,
        course_component_id: payload.courseComponentId,
        is_completed: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as LearningComponentProgress;
}
