"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Globe,
  LoaderCircle,
  Menu,
  Search,
  Users,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import { useAdminSession } from "../_lib/use-admin-session";
import {
  getPublicSurveys,
  getSurveyResults,
  getSurveyStatus,
  getSurveyQuestions,
  type Survey,
  type SurveyResultStats,
} from "../../lib/api_survey";
import type { User } from "../../lib/api_user";

const initialUser: User = {
  id: 2,
  username: "Quản trị viên",
  email: "admin@example.com",
  icon: "/icon.png",
  role: "admin",
};

export default function AdminSurveysPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<SurveyResultStats[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const { currentUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    let isMounted = true;

    async function loadSurveys() {
      if (!currentUser) return;
      try {
        const allSurveys = await getPublicSurveys();
        if (!isMounted) return;
        setSurveys(allSurveys);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách khảo sát.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSurveys();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;

  const filteredSurveys = surveys.filter((s) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      s.title.toLowerCase().includes(kw) ||
      s.description.toLowerCase().includes(kw)
    );
  });

  const activeCount = surveys.filter((s) => {
    const status = getSurveyStatus(s);
    return status.label === "Đang mở";
  }).length;

  async function handleViewResults(survey: Survey) {
    setSelectedSurvey(survey);
    setResultsLoading(true);
    setShowResults(true);
    try {
      const r = await getSurveyResults(survey.id);
      setResults(r);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể tải kết quả.",
      );
    } finally {
      setResultsLoading(false);
    }
  }

  const isAuthPending = isCheckingAuth || !currentUser;

  if (isAuthPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
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
          aria-label="Đóng"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Quản lý khảo sát</h1>
            <p className="text-sm text-slate-500">
              Giám sát tất cả khảo sát công khai trên hệ thống
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {/* Stats */}
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Tổng khảo sát</p>
              <ClipboardList className="h-5 w-5 text-sky-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {surveys.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Tất cả khảo sát trên hệ thống
            </p>
          </article>

          <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Đang hoạt động</p>
              <Globe className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {activeCount}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Khảo sát đang mở cho sinh viên
            </p>
          </article>

          <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Khảo sát công khai</p>
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {surveys.filter((s) => s.is_public).length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Được công bố cho tất cả sinh viên
            </p>
          </article>
        </section>

        {/* Search */}
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm kiếm khảo sát..."
              className="w-full rounded-xl border border-slate-300 px-9 py-2.5 text-sm outline-none focus:border-sky-400"
            />
          </label>
        </section>

        {/* Survey list */}
        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSurveys.length === 0 ? (
              <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-sm">
                {searchKeyword
                  ? "Không tìm thấy khảo sát phù hợp."
                  : "Chưa có khảo sát nào."}
              </div>
            ) : (
              filteredSurveys.map((survey) => {
                const statusInfo = getSurveyStatus(survey);
                return (
                  <div
                    key={survey.id}
                    className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      {survey.is_public ? (
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs text-sky-700">
                          Công khai
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      {survey.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                      {survey.description || "Không có mô tả"}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        Tạo:{" "}
                        {new Date(survey.created_at).toLocaleDateString("vi-VN")}
                      </span>
                      {survey.end_at ? (
                        <span>
                          Hạn:{" "}
                          {new Date(survey.end_at).toLocaleDateString("vi-VN")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleViewResults(survey)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Xem kết quả
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* Results modal */}
        {showResults && selectedSurvey ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm px-4">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Kết quả: {selectedSurvey.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResults(false)}
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {resultsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <LoaderCircle className="h-6 w-6 animate-spin text-slate-500" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Chưa có kết quả nào.
                  </p>
                ) : (
                  results.map((result, idx) => (
                    <div
                      key={result.question_id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-900">
                        {idx + 1}. {result.question_text}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Tổng: {result.total_responses} câu trả lời
                      </p>

                      {result.question_type === "text" ? (
                        <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                          {result.text_answers.map((answer, ai) => (
                            <p
                              key={ai}
                              className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              {answer}
                            </p>
                          ))}
                          {result.text_answers.length === 0 ? (
                            <p className="text-sm text-slate-400">
                              Chưa có câu trả lời văn bản.
                            </p>
                          ) : null}
                        </div>
                      ) : result.question_type === "rating" ? (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900">
                            Điểm TB:
                          </span>
                          <span className="text-lg font-semibold text-amber-600">
                            {result.rating_avg.toFixed(1)}
                          </span>
                          <span className="text-slate-500">
                            ({result.rating_count} lượt)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {Object.entries(result.choice_counts).map(
                            ([choice, count]) => (
                              <div
                                key={choice}
                                className="flex items-center gap-3"
                              >
                                <span className="w-1/3 text-sm text-slate-700 truncate">
                                  {choice}
                                </span>
                                <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-sky-500 transition-all"
                                    style={{
                                      width: `${
                                        result.total_responses > 0
                                          ? (count / result.total_responses) * 100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs text-slate-500">
                                  {count}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
