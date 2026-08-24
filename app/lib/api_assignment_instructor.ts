const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type InstructorAssignment = {
  id: number;
  title: string;
  description?: string | null;
  module_id?: number | null;
  course_id?: number | null;
  course_name?: string;
  assignment_type: string;
  assignment_content?: string | null;
  assignment_file?: string | null;
  is_active: boolean;
  pass_score: number;
  max_score: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InstructorAssignmentFilterState = {
  keyword: string;
  courseId: string;
  isActive: string;
  assignment_type: string;
};

const defaultFilters: InstructorAssignmentFilterState = {
  keyword: "",
  courseId: "all",
  isActive: "all",
  assignment_type: "all",
};

export type InstructorSubmission = {
  id: number;
  assignment_id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  submission_content?: string | null;
  submission_file?: string | null;
  submitted_at: string;
  is_graded: boolean;
  is_passed?: boolean | null;
  is_resubmitted: boolean;
  score?: number | null;
  feedback?: string | null;
  is_final_submission: boolean;
};

export type GradePayload = {
  score: number;
  feedback: string;
  is_passed: boolean;
  is_graded: boolean;
};

const endpoints = {
  assignmentsByCourse: (courseId: number) =>
    `${API_BASE_URL}/assignments/course/${courseId}`,
  assignmentById: (assignmentId: number) =>
    `${API_BASE_URL}/assignments/${assignmentId}`,
  submissionsByAssignment: (assignmentId: number) =>
    `${API_BASE_URL}/assignments_submitted/assignment/${assignmentId}`,
  submissionById: (submissionId: number) =>
    `${API_BASE_URL}/assignments_submitted/${submissionId}`,
  updateSubmission: (assignmentId: number, userId: number) =>
    `${API_BASE_URL}/assignments_submitted/update/${assignmentId}/${userId}`,
  userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  assignmentsList: () => `${API_BASE_URL}/assignments/`,
};

// Mock data
const mockCourseNames: Record<number, string> = {
  1: "Nền tảng xây dựng ứng dụng học tập với AI",
  101: "Nhập môn Machine Learning",
  102: "Deep Learning Nâng cao",
};

const mockInstructorAssignments: InstructorAssignment[] = [
  {
    id: 1,
    course_id: 1,
    course_name: mockCourseNames[1],
    module_id: 13,
    title: "Bài tập: Viết báo cáo tổng kết",
    description: "Viết báo cáo tổng kết những kiến thức đã học được trong khóa học.",
    assignment_type: "Bài tập tự luận",
    assignment_content:
      "Hãy viết một bài báo cáo tổng kết (tối thiểu 500 từ) về những kiến thức bạn đã học được trong khóa học.",
    assignment_file: null,
    is_active: true,
    pass_score: 50,
    max_score: 100,
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  },
  {
    id: 2,
    course_id: 1,
    course_name: mockCourseNames[1],
    module_id: 13,
    title: "Bài tập: Bài tập lập trình thực hành",
    description: "Thực hành lập trình với các bài tập cơ bản.",
    assignment_type: "Bài tập lập trình",
    assignment_content: "Viết chương trình giải phương trình bậc 2.",
    assignment_file: null,
    is_active: true,
    pass_score: 60,
    max_score: 100,
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  },
  {
    id: 3,
    course_id: 1,
    course_name: mockCourseNames[1],
    module_id: 13,
    title: "Bài tập: Thiết kế giao diện người dùng",
    description: "Thiết kế UI cho ứng dụng học tập.",
    assignment_type: "Bài tập nộp tệp",
    assignment_content: "Thiết kế giao diện cho ứng dụng học tập, nộp file thiết kế.",
    assignment_file: null,
    is_active: false,
    pass_score: 50,
    max_score: 100,
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  },
];

const mockUsers: Record<number, { name: string; email: string }> = {
  1: { name: "Nguyễn Văn A", email: "nguyenvana@student.edu.vn" },
  2: { name: "Trần Thị B", email: "tranthib@student.edu.vn" },
  3: { name: "Lê Văn C", email: "levanc@student.edu.vn" },
};

function getMockUser(userId: number) {
  return mockUsers[userId] ?? {
    name: `Sinh viên #${userId}`,
    email: "",
  };
}

let mockInstructorSubmissions: InstructorSubmission[] = [
  {
    id: 1,
    assignment_id: 1,
    user_id: 1,
    user_name: "Nguyễn Văn A",
    user_email: "nguyenvana@student.edu.vn",
    submission_content:
      "Trong khóa học này, em đã học được rất nhiều kiến thức bổ ích về AI và Machine Learning. Các chủ đề chính bao gồm: ...",
    submission_file: null,
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    is_graded: false,
    is_passed: null,
    is_resubmitted: false,
    score: null,
    feedback: null,
    is_final_submission: true,
  },
  {
    id: 2,
    assignment_id: 1,
    user_id: 2,
    user_name: "Trần Thị B",
    user_email: "tranthib@student.edu.vn",
    submission_content:
      "Em cảm thấy khóa học rất hữu ích. Em đã học được cách xây dựng mô hình học máy cơ bản.",
    submission_file: null,
    submitted_at: new Date(Date.now() - 172800000).toISOString(),
    is_graded: true,
    is_passed: true,
    is_resubmitted: false,
    score: 85,
    feedback: "Bài làm tốt, trình bày rõ ràng. Cần bổ sung thêm phần ứng dụng thực tế.",
    is_final_submission: true,
  },
];

async function parseError(response: Response): Promise<Error> {
  let detail = "Lỗi kết nối đến máy chủ.";
  try {
    const json = await response.json();
    if (json?.detail) detail = json.detail;
  } catch {
    // ignore
  }
  return new Error(detail);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

async function fetchJsonOrFallback<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getInstructorAssignmentById(
  assignmentId: number,
): Promise<InstructorAssignment> {
  if (USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA) {
    const found = mockInstructorAssignments.find((a) => a.id === assignmentId);
    if (!found) throw new Error("Không tìm thấy bài tập.");
    return Promise.resolve(found);
  }
  return fetchJson<InstructorAssignment>(endpoints.assignmentById(assignmentId));
}

export async function getSubmissionById(
  submissionId: number,
): Promise<(InstructorSubmission & { assignment_title?: string }) | null> {
  if (USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA) {
    const found = mockInstructorSubmissions.find((s) => s.id === submissionId);
    if (!found) return null;
    const assignment = mockInstructorAssignments.find(
      (a) => a.id === found.assignment_id,
    );
    return {
      ...found,
      assignment_title: assignment?.title ?? `Bài tập #${found.assignment_id}`,
    };
  }

  try {
    const sub = await fetchJson<InstructorSubmission>(
      endpoints.submissionById(submissionId),
    );
    return sub;
  } catch {
    return null;
  }
}

export async function getSubmissionsByAssignment(
  assignmentId: number,
): Promise<InstructorSubmission[]> {
  if (USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA) {
    return Promise.resolve(
      mockInstructorSubmissions.filter(
        (s) => s.assignment_id === assignmentId,
      ).map((submission) => {
        const user = getMockUser(submission.user_id);
        return {
          ...submission,
          user_name: user.name,
          user_email: user.email,
        };
      }),
    );
  }

  const submissions = await fetchJsonOrFallback<InstructorSubmission[]>(
    endpoints.submissionsByAssignment(assignmentId),
    [],
  );

  // Enrich with user info
  const enriched = await Promise.all(
    submissions.map(async (sub) => {
      if (sub.user_name) return sub;
      try {
        const user = await fetchJson<{ id: number; username: string; email: string }>(
          endpoints.userById(sub.user_id),
        );
        return { ...sub, user_name: user.username, user_email: user.email };
      } catch {
        return { ...sub, user_name: `Sinh viên #${sub.user_id}`, user_email: "" };
      }
    }),
  );

  return enriched;
}

export function filterInstructorAssignment(
  assignments: InstructorAssignment[],
  filters: InstructorAssignmentFilterState,
): InstructorAssignment[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return assignments.filter((assignment) => {
    const matchesKeyword =
      keyword.length === 0 ||
      assignment.title.toLowerCase().includes(keyword) ||
      (assignment.course_name ?? "").toLowerCase().includes(keyword) ||
      (assignment.description ?? "").toLowerCase().includes(keyword);

    const matchesCourse =
      filters.courseId === "all" ||
      `${assignment.course_id}` === filters.courseId;

    const matchesActive =
      filters.isActive === "all" ||
      (filters.isActive === "active" && assignment.is_active) ||
      (filters.isActive === "inactive" && !assignment.is_active);

    const matchesType =
      filters.assignment_type === "all" ||
      assignment.assignment_type === filters.assignment_type;

    return matchesKeyword && matchesCourse && matchesActive && matchesType;
  });
}

export async function getInstructorAssignmentList(
  instructorId: number,
  instructorCourses: Array<{ id: number; title: string }>,
): Promise<InstructorAssignment[]> {
  if (USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA) {
    return Promise.resolve(
      mockInstructorAssignments.map((a) => ({
        ...a,
        course_name: mockCourseNames[a.course_id ?? -1] ?? `Khóa học #${a.course_id}`,
      })),
    );
  }

  const courseMap = new Map(instructorCourses.map((c) => [c.id, c.title]));
  const allAssignments = await fetchJsonOrFallback<InstructorAssignment[]>(
    endpoints.assignmentsList(),
    [],
  );

  return allAssignments
    .filter((a) => a.course_id && courseMap.has(a.course_id))
    .map((a) => ({
      ...a,
      course_name: a.course_id ? courseMap.get(a.course_id) : undefined,
    }));
}

export { defaultFilters };

export async function getAllInstructorSubmissions(
  allAssignments: InstructorAssignment[],
): Promise<EnrichedSubmission[]> {
  if (USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA) {
    return Promise.resolve(
      mockInstructorSubmissions.map((s) => {
        const user = getMockUser(s.user_id);
        const assignment = mockInstructorAssignments.find(
          (a) => a.id === s.assignment_id,
        );
        return {
          ...s,
          user_name: user.name,
          user_email: user.email,
          assignment_title: assignment?.title ?? `Bài tập #${s.assignment_id}`,
          course_name: assignment?.course_name ?? `Khóa học #${assignment?.course_id}`,
        };
      }),
    );
  }

  const assignmentIds = allAssignments.map((a) => a.id);
  const assignmentMap = new Map(allAssignments.map((a) => [a.id, a]));

  const allSubmissions = await fetchJsonOrFallback<InstructorSubmission[]>(
    `${API_BASE_URL}/assignments_submitted/`,
    [],
  );

  const filtered = allSubmissions.filter((s) =>
    assignmentIds.includes(s.assignment_id),
  );

  return Promise.all(
    filtered.map(async (sub) => {
      const assignment = assignmentMap.get(sub.assignment_id);
      const enriched = { ...sub };

      if (!sub.user_name) {
        try {
          const user = await fetchJson<{
            id: number;
            username: string;
            email: string;
          }>(endpoints.userById(sub.user_id));
          enriched.user_name = user.username;
          enriched.user_email = user.email;
        } catch {
          enriched.user_name = `Sinh viên #${sub.user_id}`;
        }
      }

      return {
        ...enriched,
        assignment_title: assignment?.title ?? `Bài tập #${sub.assignment_id}`,
        course_name: assignment?.course_name ?? assignment?.course_id
          ? `Khóa học #${assignment.course_id}`
          : undefined,
      };
    }),
  );
}

export type EnrichedSubmission = InstructorSubmission & {
  assignment_title?: string;
  course_name?: string;
};

export async function gradeSubmission(
  assignmentId: number,
  userId: number,
  payload: GradePayload,
): Promise<InstructorSubmission> {
  if (USE_MOCK_ASSIGNMENT_INSTRUCTOR_DATA) {
    const existing = mockInstructorSubmissions.find(
      (s) => s.assignment_id === assignmentId && s.user_id === userId,
    );
    if (!existing) throw new Error("Không tìm thấy bài nộp.");

    const updated: InstructorSubmission = {
      ...existing,
      ...payload,
    };
    mockInstructorSubmissions = mockInstructorSubmissions.map((s) =>
      s.assignment_id === assignmentId && s.user_id === userId ? updated : s,
    );
    return Promise.resolve(updated);
  }

  return fetchJson<InstructorSubmission>(
    endpoints.updateSubmission(assignmentId, userId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}
