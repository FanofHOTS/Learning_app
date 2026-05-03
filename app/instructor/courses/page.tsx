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
  Menu,
} from "lucide-react";

import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import { getCurrentUser } from "../../lib/auth_client";
import { getCourseList, Course } from "../../lib/api_course";

const initialUser: User = {
  id: 0,
  username: "Giáo viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

export default function Home() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [coursesData, setCoursesData] = useState<Course[] | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
    let isMounted = true;
  
    async function loadCurrentUser() {
      try {
        // const token = <Lấy từ nơi đã lưu token đăng nhập> 
        // const data = await getCurrentUser(token);
        const data = await getCurrentUser("instructor");
  
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

  useEffect(() => {
    let isMounted = true;

    async function loadCourses() {
      try {
        const data = await getCourseList();

        if (!isMounted) {
          return;
        }

        setCoursesData(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu danh sách khóa học.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      isMounted = false;
    };
  }, []);

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
            {user.role === "instructor" ? "Giáo viên" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dach sách khóa học...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {!isLoading && !errorMessage && coursesData ? (
          <>
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">Danh sách khóa học</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {coursesData.map((course) => (
                  <Link
                    key={course.id}
                    href={`courses/${course.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
                  >
                    <Image
                      src={course.image}
                      alt={course.title}
                      width={400}
                      height={200}
                      className="mb-4 h-40 w-full rounded-md object-cover"
                    />
                    <h3 className="text-lg font-medium">{course.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {course.introduction}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ): null}
      </section>
    </main>
  );
}