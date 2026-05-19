"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getRedirectPathByRole } from "@/app/lib/auth_paths";
import type { User } from "@/app/lib/api_user";

const USE_MOCK_USER_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
const EXPECTED_ROLE = "instructor";

export const INSTRUCTOR_DEFAULT_USER: User = {
  id: 7,
  username: "Nguyễn Thiên Long",
  email: "nguyenthienlong@instructor.edu.vn",
  icon: "/icon.png",
  role: "instructor",
};

export function useInstructorSession() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(
    USE_MOCK_USER_DATA ? INSTRUCTOR_DEFAULT_USER : null,
  );
  const [isCheckingAuth, setIsCheckingAuth] = useState(!USE_MOCK_USER_DATA);

  useEffect(() => {
    if (USE_MOCK_USER_DATA) {
      return;
    }

    let isMounted = true;

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/login");
          router.refresh();
          return;
        }

        const user = (await response.json()) as User;

        if (!isMounted) {
          return;
        }

        if (user.role !== EXPECTED_ROLE) {
          router.replace(getRedirectPathByRole(user));
          router.refresh();
          return;
        }

        setCurrentUser(user);
      } catch {
        if (isMounted) {
          router.replace("/login");
          router.refresh();
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return {
    currentUser,
    isCheckingAuth,
  };
}
