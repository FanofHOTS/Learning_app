"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Menu,
} from "lucide-react";
import { ShowNavigation } from "../../../../lib/app_nav";
import type { User } from "../../../../lib/api_user";
import {
  type EnrichedStudentSubmission,
  getStudentSubmissionsWithDetails,
} from "../../../../lib/api_assignment";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../../_lib/use-student-session";
import { UserAccountMenu } from "../../../../components/user-account-menu";
import { NotificationBell } from "../../../../components/notification-bell";

const initialUser: User = STUDENT_DEFAULT_USER;

export default function CourseAssignmentsPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<EnrichedStudentSubmission[]>(
    [],
  );
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getStudentSubmissionsWithDetails(currentUser.id);

        if (!isMounted) {
          return;
        }

        setSubmissions(
          data.filter((s) => s.course_id === courseId),
        );
      } catch {
        // silently fail
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, courseId]);

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

  if (isAuthPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </main>
    );
  }

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
          aria-label="Đóng lớp nền"
          className="fixed inset-0 z-40 bg-slate-950/40"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
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
            <h1 className="text-lg font-semibold">Bài tập trong khóa học</h1>
            <p className="text-sm text-slate-500">
              Xem các bài tập đã nộp trong khóa học này
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-semibold text-slate-900">
              Bài tập trong khóa học
            </h3>
          </div>

          {isLoading ? (
            <div className="mt-8 flex items-center justify-center py-12 text-slate-500">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
              Đang tải...
            </div>
          ) : submissions.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                Chưa có bài tập nào được nộp trong khóa học này.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {submissions.map((sub) => (
                <Link
                  key={`${sub.assignment_id}-${sub.user_id}`}
                  href={`/student/courses/${courseId}/assignment/${sub.assignment_id}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 transition hover:border-sky-300 hover:bg-sky-50/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {sub.assignment_title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sub.is_graded
                        ? `${sub.score ?? "?"}đ - ${sub.is_passed ? "Đạt" : "Chưa đạt"}`
                        : "Chờ chấm"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
