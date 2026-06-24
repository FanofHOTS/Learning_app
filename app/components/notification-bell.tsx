"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, LoaderCircle, X } from "lucide-react";

import {
  checkCourseStarts,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type Notification,
} from "../lib/api_notification";

type NotificationBellProps = {
  userId: number;
};

function getNotificationIcon(type: string): string {
  switch (type) {
    case "new_course":
      return "📚";
    case "course_available":
      return "🎉";
    case "comment_reply":
      return "💬";
    case "assignment_submitted":
      return "📝";
    case "course_started":
      return "🚀";
    default:
      return "🔔";
  }
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(dateString).toLocaleDateString("vi-VN");
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      // Kiểm tra khóa học đến hạn trước khi load thông báo
      await checkCourseStarts(userId);
      const [notifData, countData] = await Promise.all([
        getNotifications(userId),
        getUnreadCount(userId),
      ]);
      setNotifications(notifData);
      setUnreadCount(countData);
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load on mount + poll every 60s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  async function toggleOpen() {
    if (!isOpen) {
      await loadNotifications();
    }
    setIsOpen((prev) => !prev);
  }

  async function handleMarkRead(notifId: number) {
    try {
      await markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Bỏ qua
    }
  }

  async function handleMarkAllRead() {
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true })),
      );
      setUnreadCount(0);
    } catch {
      // Bỏ qua
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleDelete(notifId: number) {
    try {
      await deleteNotification(notifId);
      const removed = notifications.find((n) => n.id === notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      if (removed && !removed.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Bỏ qua
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.is_read);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative rounded-full p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label="Thông báo"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 z-30 mt-3 w-[min(92vw,400px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_26px_90px_-38px_rgba(15,23,42,0.75)]"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Thông báo
              </h3>
              <p className="text-xs text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} thông báo chưa đọc`
                  : "Không có thông báo mới"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
              >
                {isMarkingAll ? (
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                <span>Đọc tất cả</span>
              </button>
            ) : null}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-sm">Đang tải...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <Bell className="mb-2 h-8 w-8" />
                <p className="text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`group relative border-b border-slate-50 px-5 py-4 transition last:border-b-0 hover:bg-slate-50 ${
                    !notif.is_read ? "bg-sky-50/60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg leading-none" aria-hidden>
                      {getNotificationIcon(notif.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          !notif.is_read
                            ? "font-semibold text-slate-900"
                            : "text-slate-700"
                        }`}
                      >
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-5 text-slate-500 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {formatTimeAgo(notif.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!notif.is_read ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notif.id)}
                          className="rounded-full p-1.5 text-sky-600 opacity-0 transition hover:bg-sky-100 group-hover:opacity-100"
                          aria-label="Đánh dấu đã đọc"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(notif.id)}
                        className="rounded-full p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        aria-label="Xóa thông báo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
