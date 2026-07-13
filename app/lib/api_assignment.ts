const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_ASSIGNMENT_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type Assignment = {
  id: number;
  title: string;
  description?: string | null;
  module_id?: number | null;
  course_id?: number | null;
  assignment_type: string;
  assignment_content?: string | null;
  assignment_file?: string | null;
  is_active: boolean;
  pass_score: number;
  max_score: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AssignmentSubmission = {
  id: number;
  assignment_id: number;
  user_id: number;
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

export type SubmissionCreatePayload = {
  assignment_id: number;
  user_id: number;
  submission_content?: string;
  submission_file?: string;
  is_final_submission?: boolean;
};

const endpoints = {
  assignmentById: (assignmentId: number) =>
    `${API_BASE_URL}/assignments/${assignmentId}`,
  submissionByAssignmentAndUser: (assignmentId: number, userId: number) =>
    `${API_BASE_URL}/assignments_submitted/${assignmentId}/${userId}`,
  createSubmission: () => `${API_BASE_URL}/assignments_submitted/create`,
  updateSubmission: (assignmentId: number, userId: number) =>
    `${API_BASE_URL}/assignments_submitted/update/${assignmentId}/${userId}`,
  uploadDocument: () => `${API_BASE_URL}/document/upload`,
  submissionsByUser: (userId: number) =>
    `${API_BASE_URL}/assignments_submitted/user/${userId}`,
};

// Mock data
const mockAssignments: Assignment[] = [
  {
    id: 1,
    course_id: 1,
    module_id: 13,
    title: "Bài tập: Viết báo cáo tổng kết",
    description: "Viết báo cáo tổng kết những kiến thức đã học được trong khóa học.",
    assignment_type: "Bài tập tự luận",
    assignment_content:
      "Hãy viết một bài báo cáo tổng kết (tối thiểu 500 từ) về những kiến thức bạn đã học được trong khóa học. Bài báo cáo cần nêu rõ:\n\n1. Những chủ đề chính bạn đã học\n2. Kiến thức nào hữu ích nhất với bạn\n3. Bạn sẽ áp dụng những kiến thức này vào thực tế như thế nào",
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
    module_id: 13,
    title: "Bài tập: Bài tập lập trình thực hành",
    description: "Thực hành lập trình với các bài tập cơ bản.",
    assignment_type: "Bài tập lập trình",
    assignment_content:
      "Viết chương trình giải phương trình bậc 2: ax² + bx + c = 0.\n\nYêu cầu:\n- Input: 3 số thực a, b, c\n- Output: nghiệm của phương trình (nếu có)",
    assignment_file: null,
    is_active: true,
    pass_score: 60,
    max_score: 100,
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  },
];

let mockSubmissions: AssignmentSubmission[] = [];

async function parseError(response: Response): Promise<Error> {
  let detail = "Lỗi kết nối đến máy chủ.";
  try {
    const json = await response.json();
    if (json?.detail) {
      detail = json.detail;
    }
  } catch {
    // ignore
  }
  return new Error(detail);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

async function fetchJsonOrFallback<T>(
  url: string,
  fallback: T,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    return fallback;
  }
  return (await response.json()) as T;
}

export async function getAssignmentById(
  assignmentId: number,
): Promise<Assignment> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    const found = mockAssignments.find((a) => a.id === assignmentId);
    if (!found) {
      throw new Error("Không tìm thấy bài tập.");
    }
    return Promise.resolve(found);
  }
  return fetchJson<Assignment>(endpoints.assignmentById(assignmentId));
}

export async function getAssignmentSubmission(
  assignmentId: number,
  userId: number,
): Promise<AssignmentSubmission | null> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    const found = mockSubmissions.find(
      (s) => s.assignment_id === assignmentId && s.user_id === userId,
    );
    return Promise.resolve(found ?? null);
  }
  return fetchJsonOrFallback<AssignmentSubmission | null>(
    endpoints.submissionByAssignmentAndUser(assignmentId, userId),
    null,
  );
}

export async function createAssignmentSubmission(
  payload: SubmissionCreatePayload,
): Promise<AssignmentSubmission> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    const newSubmission: AssignmentSubmission = {
      id: mockSubmissions.length + 1,
      assignment_id: payload.assignment_id,
      user_id: payload.user_id,
      submission_content: payload.submission_content ?? null,
      submission_file: payload.submission_file ?? null,
      submitted_at: new Date().toISOString(),
      is_graded: false,
      is_passed: null,
      is_resubmitted: mockSubmissions.some(
        (s) =>
          s.assignment_id === payload.assignment_id &&
          s.user_id === payload.user_id,
      ),
      score: null,
      feedback: null,
      is_final_submission: payload.is_final_submission ?? false,
    };
    mockSubmissions = [
      ...mockSubmissions.filter(
        (s) =>
          !(
            s.assignment_id === payload.assignment_id &&
            s.user_id === payload.user_id
          ),
      ),
      newSubmission,
    ];
    return Promise.resolve(newSubmission);
  }
  return fetchJson<AssignmentSubmission>(endpoints.createSubmission(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssignmentSubmission(
  assignmentId: number,
  userId: number,
  payload: Partial<SubmissionCreatePayload>,
): Promise<AssignmentSubmission> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    const existing = mockSubmissions.find(
      (s) => s.assignment_id === assignmentId && s.user_id === userId,
    );
    if (!existing) {
      throw new Error("Không tìm thấy bài tập đã nộp.");
    }
    const updated: AssignmentSubmission = {
      ...existing,
      ...payload,
      submission_file: payload.submission_file ?? existing.submission_file,
      submission_content:
        payload.submission_content ?? existing.submission_content,
      submitted_at: new Date().toISOString(),
      is_resubmitted: true,
    };
    mockSubmissions = mockSubmissions.map((s) =>
      s.assignment_id === assignmentId && s.user_id === userId ? updated : s,
    );
    return Promise.resolve(updated);
  }
  return fetchJson<AssignmentSubmission>(
    endpoints.updateSubmission(assignmentId, userId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateAssignment(
  assignmentId: number,
  payload: Partial<Omit<Assignment, "id">>,
): Promise<Assignment> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    const index = mockAssignments.findIndex((a) => a.id === assignmentId);
    if (index === -1) {
      throw new Error("Không tìm thấy bài tập.");
    }
    mockAssignments[index] = {
      ...mockAssignments[index],
      ...payload,
    };
    return Promise.resolve(mockAssignments[index]);
  }
  return fetchJson<Assignment>(`${API_BASE_URL}/assignments/update/${assignmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getAssignmentSubmissionsByUser(
  userId: number,
): Promise<AssignmentSubmission[]> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    return Promise.resolve(
      mockSubmissions
        .filter((s) => s.user_id === userId)
        .map((s) => ({ ...s })),
    );
  }
  return fetchJsonOrFallback<AssignmentSubmission[]>(
    endpoints.submissionsByUser(userId),
    [],
  );
}

export type EnrichedStudentSubmission = AssignmentSubmission & {
  assignment_title?: string;
  course_name?: string;
  course_id?: number;
};

export async function getStudentSubmissionsWithDetails(
  userId: number,
): Promise<EnrichedStudentSubmission[]> {
  const submissions = await getAssignmentSubmissionsByUser(userId);

  if (submissions.length === 0) {
    return [];
  }

  const uniqueAssignmentIds = [...new Set(submissions.map((s) => s.assignment_id))];

  let assignments: Assignment[];

  if (USE_MOCK_ASSIGNMENT_DATA) {
    const mockCourses = [
      { id: 1, title: "Nền tảng xây dựng ứng dụng học tập với AI" },
      { id: 2, title: "Lập trình cơ bản" },
      { id: 3, title: "Cơ sở toán trong CNTT" },
      { id: 4, title: "Toán rời rạc" },
      { id: 5, title: "Sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm" },
      { id: 6, title: "Lập trình bằng Python" },
      { id: 7, title: "Cơ sở dữ liệu" },
      { id: 8, title: "Lập trình hướng đối tượng" },
      { id: 9, title: "Mô hình hóa dữ liệu thực hành" },
    ];

    assignments = mockAssignments.filter((a) =>
      uniqueAssignmentIds.includes(a.id),
    );

    return submissions.map((sub) => {
      const assignment = assignments.find((a) => a.id === sub.assignment_id);
      const course = mockCourses.find((c) => c.id === assignment?.course_id);
      return {
        ...sub,
        assignment_title: assignment?.title ?? "Bài tập không xác định",
        course_name: course?.title ?? "Khóa học không xác định",
        course_id: assignment?.course_id ?? undefined,
      };
    });
  }

  assignments = await Promise.all(
    uniqueAssignmentIds.map((id) => getAssignmentById(id)),
  );

  const courseIds = [...new Set(assignments.map((a) => a.course_id).filter(Boolean))] as number[];

  const courses: Array<{ id: number; title: string }> = await Promise.all(
    courseIds.map((id) =>
      fetch(`${API_BASE_URL}/course/${id}`).then((res) => res.json()),
    ),
  );

  return submissions.map((sub) => {
    const assignment = assignments.find((a) => a.id === sub.assignment_id);
    const course = courses.find((c) => c.id === assignment?.course_id);
    return {
      ...sub,
      assignment_title: assignment?.title ?? "Bài tập không xác định",
      course_name: course?.title ?? "Khóa học không xác định",
      course_id: assignment?.course_id ?? undefined,
    };
  });
}

export async function uploadAssignmentFile(
  file: File,
): Promise<{ file_url: string }> {
  if (USE_MOCK_ASSIGNMENT_DATA) {
    return Promise.resolve({ file_url: `/uploads/assignments/${file.name}` });
  }
  const form = new FormData();
  form.append("file", file);
  form.append("document_type", "other");

  const response = await fetch(endpoints.uploadDocument(), {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as { file_url: string };
}
