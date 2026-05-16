"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { User } from "@/app/lib/api_user";

export function useSession() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
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
