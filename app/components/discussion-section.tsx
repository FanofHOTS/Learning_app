"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  LoaderCircle,
  MessageCircle,
  Reply,
  Trash2,
  X,
} from "lucide-react";
import type { User } from "../lib/api_user";
import {
  type DiscussionComment,
  createDiscussionComment,
  deleteDiscussionComment,
  getCommentsByComponent,
  updateDiscussionComment,
} from "../lib/api_discussion";

type DiscussionSectionProps = {
  courseComponentId: number;
  currentUser: User;
};

export default function DiscussionSection({
  courseComponentId,
  currentUser,
}: DiscussionSectionProps) {
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{
    id: number;
    username: string;
  } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // --- Các hàm helper để thao tác trên cây comments (immutable) ---

  function addCommentToTree(
    current: DiscussionComment[],
    newComment: DiscussionComment,
    parentId: number | null,
  ): DiscussionComment[] {
    if (parentId === null) {
      return [...current, newComment];
    }

    return current.map((comment) => {
      if (comment.id === parentId) {
        return { ...comment, replies: [...comment.replies, newComment] };
      }
      return { ...comment, replies: addCommentToTree(comment.replies, newComment, parentId) };
    });
  }

  function replaceCommentInTree(
    current: DiscussionComment[],
    targetId: number,
    replacement: DiscussionComment,
  ): DiscussionComment[] {
    return current.map((comment) => {
      if (comment.id === targetId) {
        return replacement;
      }
      return {
        ...comment,
        replies: replaceCommentInTree(comment.replies, targetId, replacement),
      };
    });
  }

  function updateCommentContentInTree(
    current: DiscussionComment[],
    targetId: number,
    newContent: string,
  ): DiscussionComment[] {
    return current.map((comment) => {
      if (comment.id === targetId) {
        return {
          ...comment,
          content: newContent,
          updated_at: new Date().toISOString(),
        };
      }
      return {
        ...comment,
        replies: updateCommentContentInTree(comment.replies, targetId, newContent),
      };
    });
  }

  function removeCommentFromTree(
    current: DiscussionComment[],
    targetId: number,
  ): DiscussionComment[] {
    return current
      .filter((comment) => comment.id !== targetId)
      .map((comment) => ({
        ...comment,
        replies: removeCommentFromTree(comment.replies, targetId),
      }));
  }

  // --- Auto-dismiss messages ---

  useEffect(() => {
    if (!errorMessage && !successMessage) return;

    const timer = setTimeout(() => {
      setErrorMessage("");
      setSuccessMessage("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [errorMessage, successMessage]);

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedComments = await getCommentsByComponent(courseComponentId);
      setComments(fetchedComments);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải bình luận.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [courseComponentId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  // --- Optimistic actions ---

  async function handleCreateComment() {
    if (!newComment.trim()) return;

    clearMessages();
    setIsSubmitting(true);

    const trimmedContent = newComment.trim();
    const optimisticId = -Date.now();
    const optimisticComment: DiscussionComment = {
      id: optimisticId,
      course_component_id: courseComponentId,
      user_id: currentUser.id,
      username: currentUser.username,
      user_icon: currentUser.icon,
      content: trimmedContent,
      parent_id: replyTo?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      replies: [],
    };

    // Optimistic add
    setComments((prev) => addCommentToTree(prev, optimisticComment, replyTo?.id ?? null));
    setNewComment("");
    const previousReplyTo = replyTo;
    setReplyTo(null);

    try {
      const created = await createDiscussionComment({
        course_component_id: courseComponentId,
        content: trimmedContent,
        parent_id: previousReplyTo?.id ?? null,
      });
      // Replace optimistic comment with real server response
      setComments((prev) => replaceCommentInTree(prev, optimisticId, created));
      setSuccessMessage("Đã đăng bình luận thành công.");
    } catch (error) {
      // Rollback: remove the optimistic comment
      setComments((prev) => removeCommentFromTree(prev, optimisticId));
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đăng bình luận.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateComment(commentId: number) {
    if (!editContent.trim()) return;

    clearMessages();
    setIsSubmitting(true);

    const newContent = editContent.trim();
    const beforeComments = comments;

    // Optimistic update
    setComments((prev) => updateCommentContentInTree(prev, commentId, newContent));
    setEditingCommentId(null);
    setEditContent("");

    try {
      await updateDiscussionComment(commentId, newContent);
      setSuccessMessage("Đã cập nhật bình luận thành công.");
    } catch (error) {
      // Rollback: restore previous state
      setComments(beforeComments);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật bình luận.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRequestDelete(commentId: number) {
    setConfirmDeleteId(commentId);
    setEditingCommentId(null);
    setEditContent("");
    clearMessages();
  }

  function handleCancelDelete() {
    setConfirmDeleteId(null);
  }

  async function handleConfirmDelete(commentId: number) {
    clearMessages();
    setIsSubmitting(true);
    setConfirmDeleteId(null);

    const beforeComments = comments;

    // Optimistic remove
    setComments((prev) => removeCommentFromTree(prev, commentId));

    try {
      await deleteDiscussionComment(commentId);
      setSuccessMessage("Đã xóa bình luận thành công.");
    } catch (error) {
      // Rollback: restore previous state
      setComments(beforeComments);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể xóa bình luận.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return "Vừa xong";
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderComment(
    comment: DiscussionComment,
    isReply = false,
  ) {
    const isOwnComment = comment.user_id === currentUser.id;
    const isAdmin = currentUser.role === "admin";
    const canEditDelete = isOwnComment || isAdmin;
    const isEditing = editingCommentId === comment.id;

    return (
      <div
        key={comment.id}
        className={`${isReply ? "ml-8 border-l-2 border-sky-200 pl-4" : ""} ${!isReply ? "border-b border-slate-100 pb-4 last:border-b-0" : "pb-3"}`}
      >
        {isEditing ? (
          /* Form chỉnh sửa */
          <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="Chỉnh sửa bình luận..."
              disabled={isSubmitting}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleUpdateComment(comment.id)}
                disabled={isSubmitting || !editContent.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Lưu
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(null);
                  setEditContent("");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-3.5 w-3.5" />
                Hủy
              </button>
            </div>
          </div>
        ) : (
          /* Hiển thị comment */
          <div className="group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  {comment.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {comment.username}
                    {comment.user_id === currentUser.id ? (
                      <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">
                        Bạn
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(comment.created_at)}
                    {comment.updated_at !== comment.created_at ? (
                      <span className="ml-1 text-slate-300">
                        (đã chỉnh sửa)
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              {canEditDelete && confirmDeleteId !== comment.id ? (
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setEditingCommentId(comment.id);
                      setEditContent(comment.content);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Chỉnh sửa bình luận"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestDelete(comment.id)}
                    disabled={isSubmitting}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Xóa bình luận"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {confirmDeleteId === comment.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Xóa bình luận này?</span>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(comment.id)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Xóa
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                  >
                    <X className="h-3 w-3" />
                    Hủy
                  </button>
                </div>
              ) : null}
            </div>

            <p className="mt-2 text-sm leading-7 text-slate-700">
              {comment.content}
            </p>

            <button
              type="button"
              onClick={() => {
                if (replyTo?.id === comment.id) {
                  setReplyTo(null);
                } else {
                  setReplyTo({ id: comment.id, username: comment.username });
                }
              }}
              className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-50 hover:text-sky-600"
            >
              <Reply className="h-3.5 w-3.5" />
              {replyTo?.id === comment.id ? "Hủy trả lời" : "Trả lời"}
            </button>
          </div>
        )}

        {/* Hiển thị replies */}
        {comment.replies.length > 0
          ? comment.replies.map((reply) => renderComment(reply, true))
          : null}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <MessageCircle className="h-5 w-5 text-sky-600" />
        <h3 className="text-base font-semibold text-slate-900">Thảo luận</h3>
        {!isLoading ? (
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-600">
            {comments.length} bình luận
          </span>
        ) : null}
      </div>

      {/* Thông báo lỗi */}
      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {/* Thông báo thành công */}
      {successMessage ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMessage}
          </div>
        </div>
      ) : null}

      {/* Form đăng bình luận */}
      <div className="mb-6 space-y-3">
        {replyTo ? (
          <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-700">
            <Reply className="h-4 w-4 shrink-0" />
            <span>
              Đang trả lời <strong>{replyTo.username}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-auto rounded-lg p-1 transition hover:bg-sky-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder={
            replyTo
              ? `Viết trả lời cho ${replyTo.username}...`
              : "Chia sẻ suy nghĩ của bạn về nội dung này..."
          }
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {newComment.length} ký tự
          </p>
          <button
            type="button"
            onClick={handleCreateComment}
            disabled={isSubmitting || !newComment.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Đang đăng...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                {replyTo ? "Trả lời" : "Đăng bình luận"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Danh sách bình luận */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>Chưa có bình luận nào.</p>
          <p className="mt-1 text-xs">Hãy là người đầu tiên chia sẻ suy nghĩ!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}
    </div>
  );
}
