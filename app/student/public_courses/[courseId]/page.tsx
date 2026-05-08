"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChartColumn,
  LoaderCircle,
  MapPin,
  School,
  Menu
} from "lucide-react";

import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import { getCurrentUser } from "../../../lib/auth_client";

const initialUser: User = {
  id: 0,
  username: "Học sinh",
  email: "hoc_sinh@example.com",
  icon: "/icon.png",
  role: "student",
};

export default function Home() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
    let isMounted = true;
  
    async function loadCurrentUser() {
      try {
        // const token = <Lấy từ nơi đã lưu token đăng nhập> 
        // const data = await getCurrentUser(token);
        const data = await getCurrentUser("student");
  
        if (!isMounted) {
          return;
        }
  
        setCurrentUser(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
  
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể lấy thông tin người dùng đang đăng nhập hiện tại.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
  
    loadCurrentUser();
  
    return () => {
      isMounted = false;
    };
  }, []);
 
  const user = currentUser ?? initialUser;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <ShowNavigation
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Đóng lớp nền điều hướng"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="cursor-pointer"
            onClick={() => router.push(`/${user.role}`)}
          />
          <div>
            <h1 className="text-lg font-semibold">Bảng điều khiển học sinh</h1>
            <p className="text-sm text-slate-500">
              Theo dõi tiến độ và quay lại bài học
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "student" ? "Học sinh" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>
    </main>
  );
}