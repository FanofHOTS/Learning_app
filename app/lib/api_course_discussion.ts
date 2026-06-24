import {
  USE_MOCK_DISCUSSION_DATA,
  addReplyToTree,
  parseError,
  removeFromTree,
} from "./api_discussion_shared";

export type CourseDiscussionComment = {
  id: number;
  course_id: number;
  user_id: number;
  username: string;
  user_icon: string;
  content: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  replies: CourseDiscussionComment[];
};

let mockCommentIdCounter = 1;

const mockCommentsByCourse: Record<number, CourseDiscussionComment[]> = {};

function getMockComments(courseId: number): CourseDiscussionComment[] {
  if (!mockCommentsByCourse[courseId]) {
    mockCommentsByCourse[courseId] = [
      {
        id: mockCommentIdCounter++,
        course_id: courseId,
        user_id: 2,
        username: "Võ Thiên Sơn",
        user_icon: "/icon.png",
        content:
          "Chào mừng các bạn đến với khóa học! Nếu có thắc mắc gì về nội dung, hãy đặt câu hỏi tại đây nhé.",
        parent_id: null,
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        replies: [
          {
            id: mockCommentIdCounter++,
            course_id: courseId,
            user_id: 1,
            username: "Nguyễn Văn An",
            user_icon: "/icon.png",
            content:
              "Em cảm ơn thầy! Khóa học rất hay và bổ ích ạ.",
            parent_id: 1,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            replies: [],
          },
          {
            id: mockCommentIdCounter++,
            course_id: courseId,
            user_id: 2,
            username: "Võ Thiên Sơn",
            user_icon: "/icon.png",
            content: "Cảm ơn em! Cố gắng học hết khóa học nhé.",
            parent_id: 1,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            updated_at: new Date(Date.now() - 86400000).toISOString(),
            replies: [],
          },
        ],
      },
      {
        id: mockCommentIdCounter++,
        course_id: courseId,
        user_id: 3,
        username: "Trần Thị Ngọc Sanh",
        user_icon: "/icon.png",
        content:
          "Bài giảng rất dễ hiểu. Mong sẽ có thêm nhiều ví dụ thực tế hơn trong các phần tiếp theo.",
        parent_id: null,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        replies: [],
      },
    ];
  }
  return mockCommentsByCourse[courseId];
}

function saveMockComments(courseId: number, comments: CourseDiscussionComment[]): void {
  mockCommentsByCourse[courseId] = comments;
}

// --- Public API ---

export async function getCourseComments(
  courseId: number,
): Promise<CourseDiscussionComment[]> {
  if (USE_MOCK_DISCUSSION_DATA) {
    return Promise.resolve(
      getMockComments(courseId).map((c) => ({ ...c, replies: c.replies.map((r) => ({ ...r })) })),
    );
  }

  const response = await fetch(`/api/discussion/course/${courseId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as CourseDiscussionComment[];
}

export async function createCourseComment(
  payload: {
    course_id: number;
    content: string;
    parent_id?: number | null;
  },
): Promise<CourseDiscussionComment> {
  if (USE_MOCK_DISCUSSION_DATA) {
    const newComment: CourseDiscussionComment = {
      id: mockCommentIdCounter++,
      course_id: payload.course_id,
      user_id: 1,
      username: "Nguyễn Văn An",
      user_icon: "/icon.png",
      content: payload.content,
      parent_id: payload.parent_id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      replies: [],
    };

    const comments = getMockComments(payload.course_id);
    if (payload.parent_id) {
      addReplyToTree(comments, payload.parent_id, newComment);
    } else {
      comments.push(newComment);
    }
    saveMockComments(payload.course_id, comments);

    return Promise.resolve(newComment);
  }

  const response = await fetch("/api/discussion/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as CourseDiscussionComment;
}

export async function updateCourseComment(
  commentId: number,
  content: string,
): Promise<CourseDiscussionComment> {
  if (USE_MOCK_DISCUSSION_DATA) {
    return Promise.resolve({
      id: commentId,
      course_id: 0,
      user_id: 1,
      username: "Nguyễn Văn An",
      user_icon: "/icon.png",
      content,
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      replies: [],
    });
  }

  const response = await fetch(`/api/discussion/update/${commentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as CourseDiscussionComment;
}

export async function deleteCourseComment(
  commentId: number,
): Promise<void> {
  if (USE_MOCK_DISCUSSION_DATA) {
    for (const courseId of Object.keys(mockCommentsByCourse)) {
      mockCommentsByCourse[Number(courseId)] = removeFromTree(
        mockCommentsByCourse[Number(courseId)],
        commentId,
      );
    }
    return;
  }

  const response = await fetch(`/api/discussion/delete/${commentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
