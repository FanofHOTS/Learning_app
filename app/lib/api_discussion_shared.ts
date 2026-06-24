export const USE_MOCK_DISCUSSION_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type FastApiError = {
  detail?: string;
};

export async function parseError(
  response: Response,
  fallbackMessage?: string,
): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
  }
  return fallbackMessage ?? "Không thể kết nối tới máy chủ.";
}

/**
 * Generic helper to remove a comment (by id) from a nested comment tree.
 * Returns a new array with the comment removed from all levels.
 */
export function removeFromTree<T extends { id: number; replies: T[] }>(
  comments: T[],
  commentId: number,
): T[] {
  return comments
    .filter((c) => c.id !== commentId)
    .map((c) => ({
      ...c,
      replies: removeFromTree(c.replies, commentId),
    }));
}

/**
 * Generic helper to add a reply to a comment in a nested tree.
 * Mutates the tree in place and returns true if found.
 */
export function addReplyToTree<T extends { id: number; replies: T[] }>(
  comments: T[],
  parentId: number,
  newComment: T,
): boolean {
  for (const comment of comments) {
    if (comment.id === parentId) {
      comment.replies = [...comment.replies, newComment];
      return true;
    }
    if (addReplyToTree(comment.replies, parentId, newComment)) {
      return true;
    }
  }
  return false;
}
