"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgePlus,
  Download,
  Filter,
  KeyRound,
  LoaderCircle,
  MailCheck,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { ShowNavigation } from "../../lib/app_nav";
import {
  adminRoleOptions,
  assertAdminRole,
  buildAdminUserSummary,
  createAdminUser,
  defaultAdminCreateUserForm,
  downloadUserCredentialFile,
  filterAdminUsers,
  getAdminRoleLabel,
  getAdminUsers,
  type AdminCreateUserInput,
  type AdminManagedUser,
  type AdminUserRole,
  type AdminUserRoleFilter,
} from "../../lib/api_user_admin";
import type { User } from "../../lib/api_user";
import { getCurrentUser } from "../../lib/auth_client";

const initialUser: User = {
  id: 0,
  username: "Quản trị viên",
  email: "quan_tri_vien@example.com",
  icon: "/icon.png",
  role: "admin",
};

function getRoleBadgeClass(role: string): string {
  if (role === "admin") {
    return "bg-rose-100 text-rose-700";
  }

  if (role === "instructor") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

export default function AdminUserManagementPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<AdminUserRoleFilter>("all");
  const [form, setForm] = useState<AdminCreateUserInput>({
    ...defaultAdminCreateUserForm,
  });

  const deferredKeyword = useDeferredValue(keyword);

  async function loadAdminPageData(showRefreshingState = false) {
    if (showRefreshingState) {
      setIsRefreshing(true);
    }

    try {
      const storedToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken") ?? ""
          : "";
      const currentUserData = await getCurrentUser(storedToken || "admin");
      assertAdminRole(currentUserData.role);

      const userList = await getAdminUsers(storedToken || undefined);
      setCurrentUser(currentUserData);
      setUsers(userList);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu quản lý người dùng.",
      );
    } finally {
      setIsPageLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrapPage() {
      try {
        const storedToken =
          typeof window !== "undefined"
            ? localStorage.getItem("accessToken") ?? ""
            : "";
        const currentUserData = await getCurrentUser(storedToken || "admin");
        assertAdminRole(currentUserData.role);

        const userList = await getAdminUsers(storedToken || undefined);
        if (!isMounted) {
          return;
        }

        setCurrentUser(currentUserData);
        setUsers(userList);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu quản lý người dùng.",
        );
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    }

    void bootstrapPage();

    return () => {
      isMounted = false;
    };
  }, []);

  const user = currentUser ?? initialUser;
  const filteredUsers = useMemo(
    () => filterAdminUsers(users, deferredKeyword, selectedRole),
    [deferredKeyword, selectedRole, users],
  );
  const summary = useMemo(() => buildAdminUserSummary(users), [users]);

  function updateFormField<K extends keyof AdminCreateUserInput>(
    field: K,
    value: AdminCreateUserInput[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const storedToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken") ?? ""
          : "";
      const response = await createAdminUser(form, users, storedToken || undefined);

      setUsers((previous) => [response.user, ...previous]);
      setForm({
        ...defaultAdminCreateUserForm,
        role: form.role,
      });
      setSuccessMessage(
        `Đã tạo tài khoản ${response.user.username} thành công. ${response.email_delivery_status}`,
      );

      downloadUserCredentialFile({
        email: response.user.email,
        fullName: form.name.trim() || response.user.username,
        password: response.generated_password,
        role: response.user.role,
        username: response.user.username,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo người dùng mới.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-lg font-semibold">Quản lý người dùng</h1>
            <p className="text-sm text-slate-500">
              Tạo tài khoản, rà soát thông tin và quản lý quyền truy cập hệ thống
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "admin" ? "Quản trị viên" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isPageLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu người dùng...</span>
            </div>
          </div>
        ) : (
          <>
            {errorMessage ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            <section className="rounded-[30px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-100">
                    Bảng điều phối quản trị viên
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">
                    Quản lý tài khoản người dùng tập trung, rõ ràng và an toàn
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50">
                    Trang này cho phép lọc người dùng theo từ khóa và vai trò,
                    xem đầy đủ thông tin tài khoản gồm cả mã định danh, đồng thời
                    tạo nhanh tài khoản mới với mật khẩu ngẫu nhiên.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Tài khoản đang hiển thị</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {filteredUsers.length}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Tạo file thông tin tạm</p>
                    <p className="mt-2 text-base font-semibold">
                      `.txt` sau khi tạo thành công
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tổng người dùng</p>
                  <Users className="h-5 w-5 text-sky-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {summary.total}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bao gồm toàn bộ tài khoản quản trị viên, giảng viên và học viên
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Nhóm quản trị và giảng viên</p>
                  <ShieldCheck className="h-5 w-5 text-rose-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {summary.adminCount + summary.instructorCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {summary.adminCount} quản trị viên và {summary.instructorCount}{" "}
                  giảng viên đang hoạt động
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tài khoản cần đổi mật khẩu</p>
                  <KeyRound className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {users.filter((managedUser) => managedUser.is_password_reset).length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Tài khoản được đánh dấu đổi mật khẩu ở lần đăng nhập đầu tiên
                </p>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="space-y-6">
                <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Bộ lọc người dùng</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Tìm nhanh theo mã người dùng, tên đăng nhập, email hoặc vai
                        trò.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setKeyword("");
                        setSelectedRole("all");
                      }}
                      className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Filter className="h-4 w-4" />
                      Xóa bộ lọc
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Search className="h-4 w-4" />
                        Từ khóa tìm kiếm
                      </span>
                      <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="Nhập ID, tên đăng nhập hoặc email"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <BadgePlus className="h-4 w-4" />
                        Vai trò
                      </span>
                      <select
                        value={selectedRole}
                        onChange={(event) =>
                          setSelectedRole(event.target.value as AdminUserRoleFilter)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      >
                        {adminRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>

                <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Danh sách người dùng</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Mật khẩu không được hiển thị trên giao diện quản trị.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void loadAdminPageData(true)}
                      className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Tải lại dữ liệu
                    </button>
                  </div>

                  <div className="mt-5 rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Đang hiển thị <strong>{filteredUsers.length}</strong> trên tổng số{" "}
                    <strong>{summary.total}</strong> tài khoản.
                  </div>

                  <div className="mt-5 space-y-4 lg:hidden">
                    {filteredUsers.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                        Không tìm thấy người dùng phù hợp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      filteredUsers.map((managedUser) => (
                        <article
                          key={managedUser.id}
                          className="rounded-3xl border border-slate-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                Mã người dùng
                              </p>
                              <p className="mt-1 text-lg font-semibold text-slate-900">
                                #{managedUser.id}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(
                                managedUser.role,
                              )}`}
                            >
                              {getAdminRoleLabel(managedUser.role)}
                            </span>
                          </div>

                          <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <div>
                              <p className="text-slate-400">Tên đăng nhập</p>
                              <p className="font-medium text-slate-900">
                                {managedUser.username}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Email</p>
                              <p className="font-medium text-slate-900">
                                {managedUser.email}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Trạng thái bảo mật</p>
                              <p className="font-medium text-slate-900">
                                {managedUser.is_password_reset
                                  ? "Cần đổi mật khẩu"
                                  : "Đã ổn định"}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="mt-5 hidden overflow-hidden rounded-3xl border border-slate-200 lg:block">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-sm text-slate-500">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Tên đăng nhập</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Vai trò</th>
                          <th className="px-4 py-3 font-medium">Icon</th>
                          <th className="px-4 py-3 font-medium">Bảo mật</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white text-sm">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              Không tìm thấy người dùng phù hợp với bộ lọc hiện tại.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((managedUser) => (
                            <tr key={managedUser.id} className="align-top">
                              <td className="px-4 py-4 font-semibold text-slate-900">
                                #{managedUser.id}
                              </td>
                              <td className="px-4 py-4">
                                <div className="font-medium text-slate-900">
                                  {managedUser.username}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {managedUser.email}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(
                                    managedUser.role,
                                  )}`}
                                >
                                  {getAdminRoleLabel(managedUser.role)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {managedUser.icon}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {managedUser.is_password_reset
                                  ? "Cần đổi mật khẩu"
                                  : "Đã ổn định"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>

              <div className="space-y-6">
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">Tạo người dùng mới</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Hệ thống sẽ sinh mật khẩu ngẫu nhiên, lưu bản mã hóa và tải
                        xuống file thông tin tạm sau khi tạo thành công.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                      <UserPlus className="h-5 w-5" />
                    </div>
                  </div>

                  <form className="mt-6 space-y-4" onSubmit={handleCreateUser}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Tên đăng nhập
                      </span>
                      <input
                        value={form.username}
                        onChange={(event) =>
                          updateFormField("username", event.target.value)
                        }
                        placeholder="Nhập tên đăng nhập"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Họ và tên
                      </span>
                      <input
                        value={form.name}
                        onChange={(event) =>
                          updateFormField("name", event.target.value)
                        }
                        placeholder="Nhập họ và tên người dùng"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Email
                        </span>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(event) =>
                            updateFormField("email", event.target.value)
                          }
                          placeholder="nguoidung@student.edu.vn"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Vai trò
                        </span>
                        <select
                          value={form.role}
                          onChange={(event) =>
                            updateFormField(
                              "role",
                              event.target.value as AdminUserRole,
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        >
                          {adminRoleOptions
                            .filter((option) => option.value !== "all")
                            .map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Đường dẫn icon
                      </span>
                      <input
                        value={form.icon}
                        onChange={(event) =>
                          updateFormField("icon", event.target.value)
                        }
                        placeholder="/icon.png"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Địa điểm
                        </span>
                        <input
                          value={form.location}
                          onChange={(event) =>
                            updateFormField("location", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Tổ chức
                        </span>
                        <input
                          value={form.organization}
                          onChange={(event) =>
                            updateFormField("organization", event.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Chuyên môn
                      </span>
                      <input
                        value={form.specialization}
                        onChange={(event) =>
                          updateFormField("specialization", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Mô tả
                      </span>
                      <textarea
                        value={form.description}
                        onChange={(event) =>
                          updateFormField("description", event.target.value)
                        }
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      Tạo tài khoản mới
                    </button>
                  </form>
                </article>

                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-lg font-semibold">Ghi chú triển khai tạm thời</h3>
                  <div className="mt-4 space-y-4 text-sm text-slate-600">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="flex items-center gap-2 font-medium text-slate-900">
                        <MailCheck className="h-4 w-4 text-emerald-600" />
                        Kiểm tra email mẫu
                      </p>
                      <p className="mt-2">
                        Hiện tại biểu mẫu chỉ xác nhận các email mẫu thuộc miền
                        `student.edu.vn`, `instructor.edu.vn`, `admin.edu.vn` hoặc
                        `example.com`.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="flex items-center gap-2 font-medium text-slate-900">
                        <Download className="h-4 w-4 text-sky-600" />
                        Tải thông tin đăng nhập
                      </p>
                      <p className="mt-2">
                        Sau khi tạo thành công, trình duyệt sẽ tự tải file văn bản
                        chứa tên đăng nhập và mật khẩu chưa mã hóa để quản trị viên
                        gửi thủ công cho người dùng.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="font-medium text-slate-900">
                        Thư viện hiện có và thư viện nên cài thêm
                      </p>
                      <p className="mt-2">
                        Trang hiện dùng `tailwindcss` và `lucide-react`. Nếu muốn
                        kiểm tra email chặt hơn và gửi email thật, nên bổ sung
                        `email-validator` cùng `fastapi-mail` hoặc `aiosmtplib`.
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}