"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  FileImage,
  LoaderCircle,
  Mail,
  MapPin,
  Menu,
  PencilLine,
  Save,
  UserRound,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { ShowNavigation } from "../../lib/app_nav";
import {
  deleteOldProfileIcon,
  getProfilePageData,
  shouldDeleteUploadedProfileIcon,
  updateProfileRecord,
  updateProfileUserAccount,
  uploadProfileIcon,
  validateProfileIconFile,
  validateProfileUpdate,
  type ProfilePageData,
  type ProfileUpdateInput,
} from "../../lib/api_profile";
import type { User } from "../../lib/api_user";
import { ADMIN_DEFAULT_USER, useAdminSession } from "../_lib/use-admin-session";

const initialUser: User = ADMIN_DEFAULT_USER;

type ProfileFormState = {
  name: string;
  email: string;
  location: string;
  organization: string;
  description: string;
  specialization: string;
};

function buildProfileForm(data: ProfilePageData): ProfileFormState {
  return {
    name: data.profile.name,
    email: data.profile.email,
    location: data.profile.location,
    organization: data.profile.organization,
    description: data.profile.description,
    specialization: data.profile.specialization,
  };
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [profileData, setProfileData] = useState<ProfilePageData | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [selectedIconFile, setSelectedIconFile] = useState<File | null>(null);
  const [previewIconUrl, setPreviewIconUrl] = useState("/icon.png");
  const { currentUser: sessionUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    if (sessionUser) {
      setCurrentUser((previousUser) => previousUser ?? sessionUser);
    }
  }, [sessionUser]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfilePage() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getProfilePageData(currentUser.id);

        if (!isMounted) {
          return;
        }

        setProfileData(data);
        setForm(buildProfileForm(data));
        setPreviewIconUrl(data.user.icon || "/icon.png");
        setSelectedIconFile(null);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải hồ sơ của giảng viên.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfilePage();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedIconFile) {
      setPreviewIconUrl(profileData?.user.icon || "/icon.png");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedIconFile);
    setPreviewIconUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [profileData?.user.icon, selectedIconFile]);

  const user = currentUser ?? initialUser;
  const isAuthPending = isCheckingAuth || !currentUser;

  const profilePayload = useMemo<ProfileUpdateInput | null>(() => {
    if (!form) {
      return null;
    }

    return {
      name: form.name.trim(),
      email: form.email,
      location: form.location.trim(),
      organization: form.organization.trim(),
      description: form.description.trim(),
      specialization: form.specialization.trim(),
    };
  }, [form]);

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

  function updateForm<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [key]: value,
          }
        : currentForm,
    );
  }

  async function handleSaveProfile() {
    if (!profileData || !form || !profilePayload) {
      return;
    }

    const validationMessage = validateProfileUpdate(profilePayload);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (selectedIconFile) {
      const iconValidationMessage = validateProfileIconFile(selectedIconFile.name);
      if (iconValidationMessage) {
        setErrorMessage(iconValidationMessage);
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let nextIconUrl = profileData.user.icon;
      let oldIconToDelete: string | null = null;

      if (selectedIconFile) {
        const uploadedIcon = await uploadProfileIcon(selectedIconFile);
        nextIconUrl = uploadedIcon.file_url;

        if (
          profileData.user.icon !== nextIconUrl &&
          shouldDeleteUploadedProfileIcon(profileData.user.icon)
        ) {
          oldIconToDelete = profileData.user.icon;
        }
      }

      const [savedUser, savedProfile] = await Promise.all([
        updateProfileUserAccount(profileData.user.id, {
          username: profilePayload.name,
          icon: nextIconUrl,
        }),
        updateProfileRecord(profileData.user.id, profilePayload),
      ]);

      if (oldIconToDelete) {
        await deleteOldProfileIcon(oldIconToDelete);
      }

      const nextData: ProfilePageData = {
        user: savedUser,
        profile: savedProfile,
      };

      setCurrentUser(savedUser);
      setProfileData(nextData);
      setForm(buildProfileForm(nextData));
      setSelectedIconFile(null);
      setPreviewIconUrl(savedUser.icon || "/icon.png");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu thay đổi hồ sơ.",
      );
    } finally {
      setIsSaving(false);
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
            <h1 className="text-lg font-semibold">Hồ sơ quản trị viên</h1>
            <p className="text-sm text-slate-500">
              Xem và chỉnh sửa thông tin hồ sơ cá nhân
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Quản trị viên
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải hồ sơ quản trị viên...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && profileData && form ? (
          <>
            <section className="overflow-hidden rounded-4xl bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 text-white shadow-xl">
              <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="flex items-center justify-center px-6 py-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-white/30 shadow-lg">
                      <Image
                        src={previewIconUrl || "/icon.png"}
                        alt={profileData.user.username}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold">
                      {profileData.profile.name}
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-sky-50">
                      {profileData.profile.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-7">
                  <p className="text-sm font-medium text-sky-100">
                    Thông tin tài khoản giảng viên
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/14 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-sky-100">
                        <Mail className="h-4 w-4" />
                        <span>Email</span>
                      </div>
                      <p className="mt-2 text-base font-semibold">
                        {profileData.profile.email}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/14 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-sky-100">
                        <MapPin className="h-4 w-4" />
                        <span>Địa điểm</span>
                      </div>
                      <p className="mt-2 text-base font-semibold">
                        {profileData.profile.location}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/14 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-sky-100">
                        <Briefcase className="h-4 w-4" />
                        <span>Tổ chức</span>
                      </div>
                      <p className="mt-2 text-base font-semibold">
                        {profileData.profile.organization}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/14 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-sky-100">
                        <PencilLine className="h-4 w-4" />
                        <span>Chuyên môn</span>
                      </div>
                      <p className="mt-2 text-base font-semibold">
                        {profileData.profile.specialization}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
              <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Xem hồ sơ</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Tóm tắt thông tin hiện tại của tài khoản và hồ sơ.
                    </p>
                  </div>
                  <UserRound className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Họ và tên</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {profileData.profile.name}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {profileData.profile.email}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Địa điểm</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {profileData.profile.location}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Tổ chức</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {profileData.profile.organization}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Chuyên môn</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {profileData.profile.specialization}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">Mô tả</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {profileData.profile.description}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Chỉnh sửa hồ sơ</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Email chỉ hiển thị để xem, không cho chỉnh sửa trong biểu mẫu này.
                    </p>
                  </div>
                  <PencilLine className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Họ và tên
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Email
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      disabled
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Địa điểm
                    </span>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(event) => updateForm("location", event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Tổ chức
                    </span>
                    <input
                      type="text"
                      value={form.organization}
                      onChange={(event) =>
                        updateForm("organization", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Chuyên môn
                    </span>
                    <input
                      type="text"
                      value={form.specialization}
                      onChange={(event) =>
                        updateForm("specialization", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Mô tả hồ sơ
                    </span>
                    <textarea
                      rows={5}
                      value={form.description}
                      onChange={(event) =>
                        updateForm("description", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <FileImage className="h-4 w-4" />
                      <span>Tải icon tài khoản mới</span>
                    </span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={(event) =>
                        setSelectedIconFile(event.target.files?.[0] ?? null)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Chấp nhận tệp `.png`, `.jpg`, `.jpeg` hoặc `.webp`.
                    </p>
                    {selectedIconFile ? (
                      <p className="mt-2 text-sm text-sky-700">
                        Tệp đã chọn: {selectedIconFile.name}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Giữ nguyên icon hiện tại nếu không chọn tệp mới.
                      </p>
                    )}
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                    isSaving
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {isSaving ? "Đang lưu thay đổi..." : "Lưu thay đổi hồ sơ"}
                  </span>
                </button>
              </article>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
