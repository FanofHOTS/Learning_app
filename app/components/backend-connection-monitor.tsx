"use client";

import { useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const HEALTH_CHECK_DELAY_MS = 1_500;
const RECENT_ACTIVITY_WINDOW_MS = 90_000;
const HEALTH_CHECK_TIMEOUT_MS = 120_000;
const LAST_HEALTH_CHECK_KEY = "backend-health-last-at";

function hasRecentBackendActivity(): boolean {
  const apiBaseUrl = API_BASE_URL.replace(/\/+$/, "");
  const now = performance.now();

  return performance.getEntriesByType("resource").some((entry) => {
    const isBackendRequest = entry.name.startsWith(`${apiBaseUrl}/`);
    const isRecent = now - entry.startTime < RECENT_ACTIVITY_WINDOW_MS;

    return isBackendRequest && isRecent;
  });
}

export function BackendConnectionMonitor() {
  useEffect(() => {
    const delayId = window.setTimeout(() => {
      const lastCheckAt = Number(
        window.sessionStorage.getItem(LAST_HEALTH_CHECK_KEY),
      );
      const wasCheckedRecently =
        Number.isFinite(lastCheckAt) &&
        Date.now() - lastCheckAt < RECENT_ACTIVITY_WINDOW_MS;

      if (wasCheckedRecently || hasRecentBackendActivity()) {
        return;
      }

      window.sessionStorage.setItem(LAST_HEALTH_CHECK_KEY, String(Date.now()));

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        HEALTH_CHECK_TIMEOUT_MS,
      );
      const toastId = toast.loading("Đang kết nối Backend...");

      fetch(`${API_BASE_URL.replace(/\/+$/, "")}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
          }

          toast.update(toastId, {
            render: "Backend đã sẵn sàng.",
            type: "success",
            isLoading: false,
            autoClose: 3_000,
          });
        })
        .catch(() => {
          toast.update(toastId, {
            render: "Chưa kết nối được Backend. Vui lòng thử lại sau.",
            type: "error",
            isLoading: false,
            autoClose: 6_000,
          });
        })
        .finally(() => window.clearTimeout(timeoutId));
    }, HEALTH_CHECK_DELAY_MS);

    return () => window.clearTimeout(delayId);
  }, []);

  return <ToastContainer position="top-right" autoClose={3_500} />;
}
