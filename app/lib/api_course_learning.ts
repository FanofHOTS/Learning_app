import type { FastAPICourse } from "./api_course";
import {
  getExamResultsByUser,
  type ExamResult,
} from "./api_exam";
import {
  getAssignmentSubmissionsByUser,
  type AssignmentSubmission,
} from "./api_assignment";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_COURSE_LEARNING_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

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
  component_type: "document" | "exam" | "assignment";
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

export type LearningModuleProgress = {
  course_id: number;
  module_id: number;
  user_id: number;
  components_completed: number;
  is_complete: boolean;
  completed_at: string | null;
};

export type LearningCourseProgress = {
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
  completed_at: string | null;
};

export type LearningComponentExamSummary = {
  component_id: number;
  exam_id: number | null;
  highest_result: ExamResult | null;
  latest_result: ExamResult | null;
};

export type LearningComponentAssignmentSummary = {
  component_id: number;
  assignment_id: number | null;
  latest_submission: AssignmentSubmission | null;
};

export type CourseExtraDataInfo = {
  objective: string;
  requirement: string;
  required_course_id: number | null;
  open_at: string;
  close_at: string;
  bloom_objectives?: string;
  content_structure?: string;
};

export type CourseLearningData = {
  course: FastAPICourse;
  modules: LearningModule[];
  components: LearningComponent[];
  progressRecords: LearningComponentProgress[];
  moduleProgressRecords: LearningModuleProgress[];
  courseProgressRecord: LearningCourseProgress | null;
  examResults: ExamResult[];
  examSummaries: LearningComponentExamSummary[];
  assignmentSummaries: LearningComponentAssignmentSummary[];
  courseExtraData: CourseExtraDataInfo | null;
  instructorName: string;
  instructorEmail: string;
};

type FastApiError = {
  detail?: string;
};

type LoadedLearningState = {
  course: FastAPICourse;
  modules: LearningModule[];
  components: LearningComponent[];
  progressRecords: LearningComponentProgress[];
  moduleProgressRecords: LearningModuleProgress[];
  courseProgressRecord: LearningCourseProgress | null;
  examResults: ExamResult[];
  assignmentSubmissions: AssignmentSubmission[];
};

const mockUsers = [
  { id: 2, username: "Võ Thiên Sơn", email: "vothienson@admin.edu.vn" },
  { id: 3, username: "Trần Thị Ngọc Sanh", email: "tranthingocsanh@instructor.edu.vn" },
  { id: 7, username: "Nguyễn Thiên Long", email: "nguyenthienlong@instructor.edu.vn" },
];

const endpoints = {
  courseById: (courseId: number) => `${API_BASE_URL}/course/${courseId}`,
  modulesByCourse: (courseId: number) => `${API_BASE_URL}/module/course/${courseId}`,
  componentsByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_component/course/${courseId}`,
  progressByUserAndCourse: (userId: number, courseId: number) =>
    `${API_BASE_URL}/course_component_progress/user/${userId}/course/${courseId}`,
  createComponentProgress: () => `${API_BASE_URL}/course_component_progress/create`,
  updateComponentProgress: (userId: number, componentId: number) =>
    `${API_BASE_URL}/course_component_progress/update/user/${userId}/component/${componentId}`,
  moduleProgressByUser: (userId: number) =>
    `${API_BASE_URL}/module_progress/user/${userId}`,
  createModuleProgress: () => `${API_BASE_URL}/module_progress/create`,
  updateModuleProgress: (moduleId: number, userId: number) =>
    `${API_BASE_URL}/module_progress/update/${moduleId}/${userId}`,
  courseProgressByUser: (userId: number) =>
    `${API_BASE_URL}/course_progress/user/${userId}`,
  createCourseProgress: () => `${API_BASE_URL}/course_progress/create`,
  updateCourseProgress: (courseId: number, userId: number) =>
    `${API_BASE_URL}/course_progress/update/${courseId}/${userId}`,    courseExtraData: (courseId: number) => `${API_BASE_URL}/course_extra_data/${courseId}`,
    userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  requestCertificate: (courseId: number, userId: number) =>
    `${API_BASE_URL}/certificate/issue/${courseId}/${userId}`,
};

const mockCourse: FastAPICourse = {
  id: 1,
  title: "Nền tảng xây dựng ứng dụng học tập với AI",
  category_id: 1,
  instructor_id: 2,
  introduction: "Khóa học giúp học sinhre học trực tuyến theo module và thành phần.",
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
  },    {
    id: 13,
    course_id: 1,
    title: "Module 3: Tổng kết và tự đánh giá",
    module_sequence: 3,
    type: "Đánh giá",
    introduction: "Ôn tập lại toàn bộ kiến thức trước khi kết thúc khóa học.",
    total_component: 3,
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
    ref_id: 1,
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
    ref_id: 2,
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
    ref_id: 3,
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
    ref_id: 4,
    summary:
      "Tài liệu tóm tắt những điểm cần nhớ trước khi kết thúc khóa học.",
    estimated_minutes: 10,
    is_preview: false,
  },    {
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
  {
    id: 1008,
    course_id: 1,
    module_id: 13,
    title: "Bài tập: Viết báo cáo tổng kết",
    component_sequence: 3,
    component_type: "assignment",
    ref_id: 1,
    summary: "Viết báo cáo tổng kết những kiến thức đã học được trong khóa học.",
    estimated_minutes: 45,
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

let mockModuleProgressRecords: LearningModuleProgress[] = [];
let mockCourseProgressRecords: LearningCourseProgress[] = [];

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

function getOrderedModules(modules: LearningModule[]): LearningModule[] {
  return [...modules].sort((left, right) => left.module_sequence - right.module_sequence);
}

function getOrderedComponents(
  modules: LearningModule[],
  components: LearningComponent[],
): LearningComponent[] {
  const moduleOrder = new Map<number, number>();
  getOrderedModules(modules).forEach((module) => {
    moduleOrder.set(module.id, module.module_sequence);
  });

  return [...components].sort((left, right) => {
    const leftModuleOrder = moduleOrder.get(left.module_id) ?? 0;
    const rightModuleOrder = moduleOrder.get(right.module_id) ?? 0;

    if (leftModuleOrder !== rightModuleOrder) {
      return leftModuleOrder - rightModuleOrder;
    }

    return left.component_sequence - right.component_sequence;
  });
}

function mergeComponentProgressRecord(
  records: LearningComponentProgress[],
  nextRecord: LearningComponentProgress,
): LearningComponentProgress[] {
  const otherRecords = records.filter(
    (record) => record.course_component_id !== nextRecord.course_component_id,
  );
  return [...otherRecords, nextRecord];
}

function mergeModuleProgressRecord(
  records: LearningModuleProgress[],
  nextRecord: LearningModuleProgress,
): LearningModuleProgress[] {
  const otherRecords = records.filter(
    (record) => record.module_id !== nextRecord.module_id,
  );
  return [...otherRecords, nextRecord];
}

function pickLatestResult(results: ExamResult[]): ExamResult | null {
  if (results.length === 0) {
    return null;
  }

  return [...results].sort((left, right) => {
    const leftTime = left.submitted_at ? Date.parse(left.submitted_at) : 0;
    const rightTime = right.submitted_at ? Date.parse(right.submitted_at) : 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id - left.id;
  })[0] ?? null;
}

function pickHighestResult(results: ExamResult[]): ExamResult | null {
  if (results.length === 0) {
    return null;
  }

  return [...results].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftTime = left.submitted_at ? Date.parse(left.submitted_at) : 0;
    const rightTime = right.submitted_at ? Date.parse(right.submitted_at) : 0;
    return rightTime - leftTime;
  })[0] ?? null;
}

function buildExamSummaries(
  components: LearningComponent[],
  examResults: ExamResult[],
): LearningComponentExamSummary[] {
  return components
    .filter((component) => component.component_type === "exam")
    .map((component) => {
      const examId = component.ref_id;
      const relatedResults =
        examId === null
          ? []
          : examResults.filter((result) => result.exam_id === examId);

      return {
        component_id: component.id,
        exam_id: examId,
        highest_result: pickHighestResult(relatedResults),
        latest_result: pickLatestResult(relatedResults),
      };
    });
}

function calculateFinalScore(
  components: LearningComponent[],
  examSummaries: LearningComponentExamSummary[],
  assignmentSummaries: LearningComponentAssignmentSummary[],
): number {
  const examScores = components
    .filter((component) => component.component_type === "exam")
    .map((component) =>
      examSummaries.find((summary) => summary.component_id === component.id)
        ?.highest_result?.score,
    )
    .filter((score): score is number => typeof score === "number");

  const assignmentScores = components
    .filter((component) => component.component_type === "assignment")
    .map((component) => {
      const summary = assignmentSummaries.find(
        (s) => s.component_id === component.id,
      );
      return summary?.latest_submission?.is_graded
        ? summary.latest_submission.score
        : null;
    })
    .filter((score): score is number => score !== null && score !== undefined);

  const allScores = [...examScores, ...assignmentScores];

  if (allScores.length === 0) {
    return 0;
  }

  return Math.round(
    allScores.reduce((total, score) => total + score, 0) / allScores.length,
  );
}

async function upsertComponentProgress(params: {
  existingRecords: LearningComponentProgress[];
  userId: number;
  courseId: number;
  moduleId: number;
  courseComponentId: number;
  isCompleted: boolean;
  completedAt: string | null;
}): Promise<LearningComponentProgress> {
  const existingRecord = params.existingRecords.find(
    (record) => record.course_component_id === params.courseComponentId,
  );

  if (USE_MOCK_COURSE_LEARNING_DATA) {
    if (existingRecord) {
      if (existingRecord.is_completed === params.isCompleted) {
        return { ...existingRecord };
      }

      const updatedRecord = {
        ...existingRecord,
        is_completed: params.isCompleted,
        completed_at: params.completedAt,
      };
      mockProgressRecords = mergeComponentProgressRecord(
        mockProgressRecords,
        updatedRecord,
      );
      return updatedRecord;
    }

    const newRecord: LearningComponentProgress = {
      id: mockProgressRecords.length + 1,
      user_id: params.userId,
      course_id: params.courseId,
      module_id: params.moduleId,
      course_component_id: params.courseComponentId,
      is_completed: params.isCompleted,
      completed_at: params.completedAt,
    };

    mockProgressRecords = [...mockProgressRecords, newRecord];
    return newRecord;
  }

  const payload = {
    id: existingRecord?.id,
    user_id: params.userId,
    course_id: params.courseId,
    module_id: params.moduleId,
    course_component_id: params.courseComponentId,
    is_completed: params.isCompleted,
    completed_at: params.completedAt,
  };

  if (existingRecord) {
    return putJson<LearningComponentProgress>(
      endpoints.updateComponentProgress(params.userId, params.courseComponentId),
      payload,
    );
  }

  return postJson<LearningComponentProgress>(
    endpoints.createComponentProgress(),
    payload,
  );
}

async function upsertModuleProgress(params: {
  existingRecords: LearningModuleProgress[];
  userId: number;
  courseId: number;
  moduleId: number;
  componentsCompleted: number;
  isComplete: boolean;
  completedAt: string | null;
}): Promise<LearningModuleProgress> {
  const existingRecord = params.existingRecords.find(
    (record) => record.module_id === params.moduleId,
  );

  if (USE_MOCK_COURSE_LEARNING_DATA) {
    const nextRecord: LearningModuleProgress = {
      course_id: params.courseId,
      module_id: params.moduleId,
      user_id: params.userId,
      components_completed: params.componentsCompleted,
      is_complete: params.isComplete,
      completed_at: params.completedAt,
    };
    mockModuleProgressRecords = mergeModuleProgressRecord(
      mockModuleProgressRecords,
      nextRecord,
    );
    return nextRecord;
  }

  const payload = {
    course_id: params.courseId,
    module_id: params.moduleId,
    user_id: params.userId,
    components_completed: params.componentsCompleted,
    is_complete: params.isComplete,
    completed_at: params.completedAt,
  };

  if (existingRecord) {
    return putJson<LearningModuleProgress>(
      endpoints.updateModuleProgress(params.moduleId, params.userId),
      payload,
    );
  }

  return postJson<LearningModuleProgress>(endpoints.createModuleProgress(), payload);
}

async function upsertCourseProgress(params: {
  existingRecord: LearningCourseProgress | null;
  userId: number;
  courseId: number;
  moduleCompleted: number;
  isComplete: boolean;
  finalScore: number;
  completedAt: string | null;
}): Promise<LearningCourseProgress> {
  const nextRecord: LearningCourseProgress = {
    course_id: params.courseId,
    user_id: params.userId,
    module_completed: params.moduleCompleted,
    is_complete: params.isComplete,
    final_score: params.finalScore,
    completed_at: params.completedAt,
  };

  if (USE_MOCK_COURSE_LEARNING_DATA) {
    mockCourseProgressRecords = [
      ...mockCourseProgressRecords.filter(
        (record) => !(record.course_id === params.courseId && record.user_id === params.userId),
      ),
      nextRecord,
    ];
    return nextRecord;
  }

  if (params.existingRecord) {
    return putJson<LearningCourseProgress>(
      endpoints.updateCourseProgress(params.courseId, params.userId),
      nextRecord,
    );
  }

  return postJson<LearningCourseProgress>(endpoints.createCourseProgress(), nextRecord);
}  async function loadLearningState(
  courseId: number,
  userId: number,
): Promise<LoadedLearningState> {
  if (USE_MOCK_COURSE_LEARNING_DATA) {
    const course = { ...mockCourse, id: courseId };
    const modules = mockModules.map((module) => ({ ...module, course_id: courseId }));
    const components = mockComponents.map((component) => ({
      ...component,
      course_id: courseId,
    }));
    const examIds = components
      .filter((component) => component.component_type === "exam" && component.ref_id !== null)
      .map((component) => component.ref_id as number);
    const examResults = (await getExamResultsByUser(userId)).filter((result) =>
      examIds.includes(result.exam_id),
    );
    const assignmentSubmissions = await getAssignmentSubmissionsByUser(userId);

    return {
      course,
      modules,
      components,
      progressRecords: mockProgressRecords
        .filter((record) => record.course_id === courseId && record.user_id === userId)
        .map((record) => ({ ...record })),
      moduleProgressRecords: mockModuleProgressRecords
        .filter((record) => record.course_id === courseId && record.user_id === userId)
        .map((record) => ({ ...record })),
      courseProgressRecord:
        mockCourseProgressRecords.find(
          (record) => record.course_id === courseId && record.user_id === userId,
        ) ?? null,
      examResults,
      assignmentSubmissions,
    };
  }

  const [course, modules, components, progressRecords, allModuleProgresses, allCourseProgresses, examResults, assignmentSubmissions] =
    await Promise.all([
      getJson<FastAPICourse>(endpoints.courseById(courseId)),
      getJsonOrFallback<LearningModule[]>(endpoints.modulesByCourse(courseId), []),
      getJsonOrFallback<LearningComponent[]>(
        endpoints.componentsByCourse(courseId),
        [],
      ),
      getJsonOrFallback<LearningComponentProgress[]>(
        endpoints.progressByUserAndCourse(userId, courseId),
        [],
      ),
      getJsonOrFallback<LearningModuleProgress[]>(
        endpoints.moduleProgressByUser(userId),
        [],
      ),
      getJsonOrFallback<LearningCourseProgress[]>(
        endpoints.courseProgressByUser(userId),
        [],
      ),
      getExamResultsByUser(userId),
      getAssignmentSubmissionsByUser(userId),
    ]);

  const relevantExamIds = components
    .filter((component) => component.component_type === "exam" && component.ref_id !== null)
    .map((component) => component.ref_id as number);

  return {
    course,
    modules,
    components,
    progressRecords,
    moduleProgressRecords: allModuleProgresses.filter(
      (record) => record.course_id === courseId,
    ),
    courseProgressRecord:
      allCourseProgresses.find((record) => record.course_id === courseId) ?? null,
    examResults: examResults.filter((result) => relevantExamIds.includes(result.exam_id)),
    assignmentSubmissions,
  };
}

async function fetchCourseExtraDataById(courseId: number): Promise<CourseExtraDataInfo | null> {
  if (USE_MOCK_COURSE_LEARNING_DATA) {
    return {
      objective: "Mục tiêu khóa học",
      requirement: "Yêu cầu khóa học",
      required_course_id: null,
      open_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      close_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    };
  }

  try {
    const data = await getJson<CourseExtraDataInfo & { course_id: number }>(
      endpoints.courseExtraData(courseId),
    );
    return {
      objective: data.objective,
      requirement: data.requirement,
      required_course_id: data.required_course_id ?? null,
      open_at: data.open_at,
      close_at: data.close_at,
    };
  } catch {
    return null;
  }
}

type InstructorInfo = {
  name: string;
  email: string;
};

async function fetchInstructorInfo(course: FastAPICourse): Promise<InstructorInfo> {
  if (USE_MOCK_COURSE_LEARNING_DATA) {
    const instructor = mockUsers.find((u) => u.id === course.instructor_id);
    return {
      name: instructor?.username ?? "Chưa cập nhật",
      email: instructor?.email ?? "",
    };
  }

  try {
    const user = await getJson<{ id: number; username: string; email: string }>(
      endpoints.userById(course.instructor_id),
    );
    return {
      name: user.username,
      email: user.email,
    };
  } catch {
    return { name: "Chưa cập nhật", email: "" };
  }
}function buildAssignmentSummaries(
  components: LearningComponent[],
  submissions: AssignmentSubmission[],
): LearningComponentAssignmentSummary[] {
  return components
    .filter((component) => component.component_type === "assignment")
    .map((component) => {
      const assignmentId = component.ref_id;
      const relatedSubmissions =
        assignmentId === null
          ? []
          : submissions.filter((s) => s.assignment_id === assignmentId);

      const latestSubmission =
        relatedSubmissions.length > 0
          ? relatedSubmissions.sort((left, right) => {
              const leftTime = left.submitted_at
                ? Date.parse(left.submitted_at)
                : 0;
              const rightTime = right.submitted_at
                ? Date.parse(right.submitted_at)
                : 0;
              return rightTime - leftTime;
            })[0] ?? null
          : null;

      return {
        component_id: component.id,
        assignment_id: assignmentId,
        latest_submission: latestSubmission,
      };
    });
}

  async function synchronizeLearningState(
  state: LoadedLearningState,
  userId: number,
): Promise<CourseLearningData> {
  const modules = getOrderedModules(state.modules);
  const components = getOrderedComponents(modules, state.components);
  const examSummaries = buildExamSummaries(components, state.examResults);
  const assignmentSummaries = buildAssignmentSummaries(
    components,
    state.assignmentSubmissions,
  );

  const [courseExtraData, instructorInfo] = await Promise.all([
    fetchCourseExtraDataById(state.course.id),
    fetchInstructorInfo(state.course),
  ]);

  let progressRecords = [...state.progressRecords];
  let moduleProgressRecords = [...state.moduleProgressRecords];
  let courseProgressRecord = state.courseProgressRecord;

  for (const component of components) {
    if (component.component_type !== "exam") {
      continue;
    }

    const existingProgress = progressRecords.find(
      (record) => record.course_component_id === component.id,
    );
    const examSummary = examSummaries.find(
      (summary) => summary.component_id === component.id,
    );
    const latestResult = examSummary?.latest_result ?? null;

    if (!latestResult || existingProgress?.is_completed) {
      continue;
    }

    const savedProgress = await upsertComponentProgress({
      existingRecords: progressRecords,
      userId,
      courseId: state.course.id,
      moduleId: component.module_id,
      courseComponentId: component.id,
      isCompleted: true,
      completedAt: latestResult.submitted_at ?? new Date().toISOString(),
    });

    progressRecords = mergeComponentProgressRecord(progressRecords, savedProgress);
  }

  const completedComponentIds = new Set(
    progressRecords
      .filter((record) => record.is_completed)
      .map((record) => record.course_component_id),
  );

  for (const learningModule of modules) {
    const moduleComponents = components.filter(
      (component) => component.module_id === learningModule.id,
    );
    const componentsCompleted = moduleComponents.filter((component) =>
      completedComponentIds.has(component.id),
    ).length;
    const isComplete =
      moduleComponents.length > 0 && componentsCompleted === moduleComponents.length;
    const existingModuleProgress =
      moduleProgressRecords.find((record) => record.module_id === learningModule.id) ?? null;
    const completedAt = isComplete
      ? existingModuleProgress?.completed_at ?? new Date().toISOString()
      : null;

    const needsUpdate =
      !existingModuleProgress ||
      existingModuleProgress.components_completed !== componentsCompleted ||
      existingModuleProgress.is_complete !== isComplete ||
      existingModuleProgress.completed_at !== completedAt;

    if (!needsUpdate) {
      continue;
    }

    const savedModuleProgress = await upsertModuleProgress({
      existingRecords: moduleProgressRecords,
      userId,
      courseId: state.course.id,
      moduleId: learningModule.id,
      componentsCompleted,
      isComplete,
      completedAt,
    });

    moduleProgressRecords = mergeModuleProgressRecord(
      moduleProgressRecords,
      savedModuleProgress,
    );
  }

  const moduleCompleted = moduleProgressRecords.filter(
    (record) => record.is_complete,
  ).length;
  const isCourseComplete =
    components.length > 0 &&
    components.every((component) => completedComponentIds.has(component.id));
  const finalScore = isCourseComplete
    ? calculateFinalScore(components, examSummaries, assignmentSummaries)
    : courseProgressRecord?.final_score ?? 0;
  const courseCompletedAt = isCourseComplete
    ? courseProgressRecord?.completed_at ?? new Date().toISOString()
    : null;
  const needsCourseUpdate =
    !courseProgressRecord ||
    courseProgressRecord.module_completed !== moduleCompleted ||
    courseProgressRecord.is_complete !== isCourseComplete ||
    courseProgressRecord.final_score !== finalScore ||
    courseProgressRecord.completed_at !== courseCompletedAt;

  if (needsCourseUpdate) {
    courseProgressRecord = await upsertCourseProgress({
      existingRecord: courseProgressRecord,
      userId,
      courseId: state.course.id,
      moduleCompleted,
      isComplete: isCourseComplete,
      finalScore,
      completedAt: courseCompletedAt,
    });
  }

  return {
    course: state.course,
    modules,
    components,
    progressRecords: getOrderedComponents(modules, components)
      .map((component) =>
        progressRecords.find(
          (record) => record.course_component_id === component.id,
        ) ?? null,
      )
      .filter((record): record is LearningComponentProgress => record !== null),
    moduleProgressRecords: modules
      .map((module) =>
        moduleProgressRecords.find((record) => record.module_id === module.id) ?? null,
      )
      .filter((record): record is LearningModuleProgress => record !== null),
    courseProgressRecord,
    examResults: [...state.examResults].sort((left, right) => {
      const leftTime = left.submitted_at ? Date.parse(left.submitted_at) : 0;
      const rightTime = right.submitted_at ? Date.parse(right.submitted_at) : 0;
      return rightTime - leftTime;
    }),
    examSummaries,
    assignmentSummaries,
    courseExtraData,
    instructorName: instructorInfo.name,
    instructorEmail: instructorInfo.email,
  };
}

export async function getCourseLearningData(
  courseId: number,
  userId: number,
): Promise<CourseLearningData> {
  const loadedState = await loadLearningState(courseId, userId);
  return synchronizeLearningState(loadedState, userId);
}

export async function completeCourseComponentAndSyncProgress(payload: {
  userId: number;
  courseId: number;
  moduleId: number;
  courseComponentId: number;
}): Promise<CourseLearningData> {
  const loadedState = await loadLearningState(payload.courseId, payload.userId);
  const existingRecord = loadedState.progressRecords.find(
    (record) => record.course_component_id === payload.courseComponentId,
  );

  if (!existingRecord?.is_completed) {
    const savedProgress = await upsertComponentProgress({
      existingRecords: loadedState.progressRecords,
      userId: payload.userId,
      courseId: payload.courseId,
      moduleId: payload.moduleId,
      courseComponentId: payload.courseComponentId,
      isCompleted: true,
      completedAt: existingRecord?.completed_at ?? new Date().toISOString(),
    });

    loadedState.progressRecords = mergeComponentProgressRecord(
      loadedState.progressRecords,
      savedProgress,
    );
  }

  return synchronizeLearningState(loadedState, payload.userId);
}

export async function markCourseComponentCompleted(payload: {
  userId: number;
  courseId: number;
  moduleId: number;
  courseComponentId: number;
}): Promise<LearningComponentProgress> {
  const learningData = await completeCourseComponentAndSyncProgress(payload);
  const record = learningData.progressRecords.find(
    (item) => item.course_component_id === payload.courseComponentId,
  );

  if (!record) {
    throw new Error("Không thể ghi nhận tiến trình hoàn thành thành phần học tập.");
  }

  return record;
}
