import {
  USE_MOCK_DISCUSSION_DATA,
  parseError,
  removeFromTree,
} from "./api_discussion_shared";

export type DiscussionComment = {
  id: number;
  course_component_id: number;
  user_id: number;
  username: string;
  user_icon: string;
  content: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  replies: DiscussionComment[];
};

// Mock data
const mockComments: DiscussionComment[] = [
  {
    id: 1,
    course_component_id: 1001,
    user_id: 1,
    username: "Nguyễn Văn An",
    user_icon: "/icon.png",
    content:
      "Bài học rất hay và dễ hiểu! Cảm ơn giảng viên đã biên soạn tài liệu chi tiết.",
    parent_id: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    replies: [
      {
        id: 2,
        course_component_id: 1001,
        user_id: 3,
        username: "Giảng viên",
        user_icon: "/icon.png",
        content:
          "Cảm ơn em! Nếu có thắc mắc gì thêm thì cứ đặt câu hỏi nhé.",
        parent_id: 1,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
        replies: [],
      },
    ],
  },
  {
    id: 3,
    course_component_id: 1001,
    user_id: 2,
    username: "Võ Thiên Sơn",
    user_icon: "/icon.png",
    content:
      "Phần này có thể bổ sung thêm ví dụ thực tế để sinh viên dễ hình dung hơn.",
    parent_id: null,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    replies: [],
  },
];

let mockCommentIdCounter = 4;

export async function getCommentsByComponent(
  componentId: number,
): Promise<DiscussionComment[]> {
  if (USE_MOCK_DISCUSSION_DATA) {
    return Promise.resolve(
      mockComments.filter(
        (c) => c.course_component_id === componentId,
      ),
    );
  }

  const response = await fetch(`/api/discussion/component/${componentId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DiscussionComment[];
}

export async function createDiscussionComment(
  payload: {
    course_component_id: number;
    content: string;
    parent_id?: number | null;
  },
): Promise<DiscussionComment> {
  if (USE_MOCK_DISCUSSION_DATA) {
    const newComment: DiscussionComment = {
      id: mockCommentIdCounter++,
      course_component_id: payload.course_component_id,
      user_id: 1,
      username: "Nguyễn Văn An",
      user_icon: "/icon.png",
      content: payload.content,
      parent_id: payload.parent_id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      replies: [],
    };

    if (payload.parent_id) {
      const addReply = (comments: DiscussionComment[]): boolean => {
        for (const comment of comments) {
          if (comment.id === payload.parent_id) {
            comment.replies = [...comment.replies, newComment];
            return true;
          }
          if (addReply(comment.replies)) {
            return true;
          }
        }
        return false;
      };
      addReply(mockComments);
    } else {
      mockComments.push(newComment);
    }

    return Promise.resolve(newComment);
  }

  const response = await fetch("/api/discussion/component/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DiscussionComment;
}

export async function updateDiscussionComment(
  commentId: number,
  content: string,
): Promise<DiscussionComment> {
  if (USE_MOCK_DISCUSSION_DATA) {
    const updateInTree = (comments: DiscussionComment[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.content = content;
          comment.updated_at = new Date().toISOString();
          return true;
        }
        if (updateInTree(comment.replies)) {
          return true;
        }
      }
      return false;
    };
    updateInTree(mockComments);

    return Promise.resolve({
      id: commentId,
      course_component_id: 0,
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

  const response = await fetch(`/api/discussion/component/update/${commentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as DiscussionComment;
}

export async function deleteDiscussionComment(
  commentId: number,
): Promise<void> {
  if (USE_MOCK_DISCUSSION_DATA) {
    mockComments.length = 0;
    mockComments.push(...removeFromTree(mockComments, commentId));
    return;
  }

  const response = await fetch(`/api/discussion/component/delete/${commentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
