import { parseError } from "./api_discussion_shared";

export type Notification = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  reference_id: number | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
};

// --- Public API ---

/** Kiểm tra và tạo thông báo cho các khóa học đã đến hạn mở (open_at <= now) */
export async function checkCourseStarts(
  userId: number,
): Promise<{ created: number; message: string }> {
  const response = await fetch(`/api/notification/check-course-starts/${userId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as { created: number; message: string };
}

export async function getNotifications(
  userId: number,
): Promise<Notification[]> {
  const response = await fetch(`/api/notification/user/${userId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as Notification[];
}

export async function getUnreadCount(
  userId: number,
): Promise<number> {
  const response = await fetch(`/api/notification/unread-count/${userId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { count: number };
  return data.count;
}

export async function markNotificationRead(
  notificationId: number,
): Promise<void> {
  const response = await fetch(`/api/notification/read/${notificationId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function markAllNotificationsRead(
  userId: number,
): Promise<void> {
  const response = await fetch(`/api/notification/read-all/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function deleteNotification(
  notificationId: number,
): Promise<void> {
  const response = await fetch(`/api/notification/delete/${notificationId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
