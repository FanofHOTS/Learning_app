"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  Check,
  FileImage,
  ImageIcon,
  LoaderCircle,
  Menu,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import {
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  activateTemplate,
  deactivateTemplate,
  uploadTemplateFile,
  type CertificateTemplate,
  type CertificateTemplateCreate,
} from "../../lib/api_certificate";
import { ADMIN_DEFAULT_USER, useAdminSession } from "../_lib/use-admin-session";

const initialUser: User = ADMIN_DEFAULT_USER;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function validateTemplateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Tên mẫu chứng chỉ không được để trống.";
  }
  if (trimmed.length > 200) {
    return "Tên mẫu chứng chỉ không được vượt quá 200 ký tự.";
  }
  return null;
}

export default function AdminTemplatesPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { currentUser, isCheckingAuth } = useAdminSession();

  // Create/edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<CertificateTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");

  // Upload state
  const [uploadingTemplateId, setUploadingTemplateId] = useState<
    number | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getAllTemplates();
        if (!isMounted) return;
        setTemplates(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách mẫu chứng chỉ.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadTemplates();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;
  const isAuthPending = isCheckingAuth || !currentUser;

  async function refreshTemplates() {
    try {
      const data = await getAllTemplates();
      setTemplates(data);
      return data;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải lại danh sách.",
      );
      return [];
    }
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setFormName("");
    setFormDescription("");
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(template: CertificateTemplate) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description ?? "");
    setFormError("");
    setShowModal(true);
  }

  async function handleSaveTemplate() {
    setFormError("");
    const validationError = validateTemplateName(formName);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const payload: CertificateTemplateCreate = {
        name: formName.trim(),
        description: formDescription.trim() || null,
      };

      if (editingTemplate) {
        const updated = await updateTemplate(editingTemplate.id, payload);
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        );
      } else {
        const created = await createTemplate(payload);
        setTemplates((prev) => [...prev, created]);
      }

      setShowModal(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Không thể lưu mẫu chứng chỉ.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(
    template: CertificateTemplate,
  ) {
    try {
      if (template.is_active) {
        await deactivateTemplate(template.id);
      }
      else {
        await activateTemplate(template.id);
      }
      const updated = await refreshTemplates();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể thay đổi trạng thái.",
      );
    }
  }

  async function handleDeleteTemplate(templateId: number) {
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setDeleteConfirmId(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể xóa mẫu chứng chỉ.",
      );
    }
  }

  async function handleFileUpload(
    templateId: number,
    file: File | null,
  ) {
    if (!file) return;

    // Validate file type
    const allowedExtensions = /\.(png|jpg|jpeg|pdf|bmp|webp)$/i;
    if (!allowedExtensions.test(file.name)) {
      setErrorMessage(
        "Vui lòng chọn tệp ảnh (.png, .jpg, .jpeg, .bmp, .webp) hoặc PDF (.pdf).",
      );
      return;
    }

    setUploadingTemplateId(templateId);
    try {
      const result = await uploadTemplateFile(templateId, file);
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? result.template : t)),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải lên tệp mẫu.",
      );
    } finally {
      setUploadingTemplateId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const activeTemplate = templates.find((t) => t.is_active);

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
            <h1 className="text-lg font-semibold">Mẫu chứng chỉ</h1>
            <p className="text-sm text-slate-500">
              Quản lý các mẫu chứng chỉ dùng để cấp cho sinh viên
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
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

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải danh sách mẫu chứng chỉ...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="flex items-start gap-3 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Có lỗi xảy ra</p>
              <p className="mt-1 text-sm">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="shrink-0 rounded-full p-1 hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            {/* Hero */}
            <section className="overflow-hidden rounded-[34px] bg-linear-to-br from-sky-700 via-cyan-700 to-emerald-600 text-white shadow-xl">
              <div className="relative px-6 py-7 md:px-8">
                <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5" />

                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-sm text-sky-50">
                      <Award className="h-4 w-4" />
                      <span>Quản lý giao diện chứng chỉ</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                      Có{" "}
                      <span className="text-amber-200">
                        {templates.length}
                      </span>{" "}
                      mẫu chứng chỉ trong hệ thống
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-sky-50 sm:text-base">
                      Mẫu chứng chỉ là hình nền dùng để tạo chứng chỉ cho học
                      viên. Bạn có thể tạo, chỉnh sửa và kích hoạt mẫu phù hợp.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-sky-800 shadow-lg transition-all hover:bg-sky-50"
                  >
                    <Plus className="h-5 w-5" />
                    Thêm mẫu mới
                  </button>
                </div>
              </div>
            </section>

            {/* Active template card */}
            {activeTemplate ? (
              <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                      <Check className="h-7 w-7 text-emerald-700" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
                          Đang sử dụng
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                          ID #{activeTemplate.id}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {activeTemplate.name}
                      </h3>
                      {activeTemplate.description ? (
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                          {activeTemplate.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">
                        Cập nhật lần cuối:{" "}
                        {formatDate(activeTemplate.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(activeTemplate)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <PencilLine className="h-4 w-4" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(activeTemplate)}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Hủy kích hoạt
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-dashed border-amber-300 bg-amber-50/60 px-6 py-6 text-center shadow-sm">
                <p className="text-base font-semibold text-amber-800">
                  Chưa có mẫu chứng chỉ nào được kích hoạt
                </p>
                <p className="mt-2 text-sm text-amber-700">
                  Khi kích hoạt một mẫu, chứng chỉ mới sẽ được tạo với giao diện
                  của mẫu đó. Nếu không có mẫu nào được kích hoạt, hệ thống sẽ
                  dùng giao diện mặc định.
                </p>
              </section>
            )}

            {/* Template list (or empty state) */}
            {templates.length > 0 ? (
              <section className="rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      Danh sách mẫu chứng chỉ
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Tổng cộng {templates.length} mẫu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshTemplates()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Làm mới
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`px-6 py-5 transition-colors hover:bg-slate-50 ${
                        template.is_active ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${
                              template.is_active
                                ? "bg-emerald-100"
                                : "bg-slate-100"
                            }`}
                          >
                            {template.file_url ? (
                              <FileImage
                                className={`h-7 w-7 ${
                                  template.is_active
                                    ? "text-emerald-600"
                                    : "text-slate-500"
                                }`}
                              />
                            ) : (
                              <ImageIcon
                                className={`h-7 w-7 ${
                                  template.is_active
                                    ? "text-emerald-600"
                                    : "text-slate-500"
                                }`}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-semibold text-slate-950">
                                {template.name}
                              </h4>
                              {template.is_active ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  Active
                                </span>
                              ) : null}
                            </div>
                            {template.description ? (
                              <p className="mt-1 max-w-xl truncate text-sm text-slate-500">
                                {template.description}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span>ID: #{template.id}</span>
                              <span>
                                Tạo: {formatDate(template.created_at)}
                              </span>
                              {template.file_url ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <Check className="h-3 w-3" />
                                  Đã có file mẫu
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Chưa có file mẫu
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Upload file */}
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".png,.jpg,.jpeg,.pdf,.bmp,.webp"
                              className="hidden"
                              onChange={(e) =>
                                handleFileUpload(
                                  template.id,
                                  e.target.files?.[0] ?? null,
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingTemplateId === template.id}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {uploadingTemplateId === template.id ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              Tải file
                            </button>
                          </div>

                          {/* Toggle active */}
                          {template.is_active ? (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(template)}
                              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Hủy kích hoạt
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(template)}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                            >
                              <Check className="h-4 w-4" />
                              Kích hoạt
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => openEditModal(template)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          {deleteConfirmId === template.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteTemplate(template.id)
                                }
                                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(template.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-50">
                  <Award className="h-8 w-8 text-sky-400" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">
                  Chưa có mẫu chứng chỉ nào
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Tạo mẫu chứng chỉ đầu tiên để bắt đầu. Bạn có thể tải lên hình
                  ảnh hoặc PDF làm nền cho chứng chỉ.
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Tạo mẫu mới
                </button>
              </section>
            )}
          </>
        ) : null}
      </section>

      {/* Create / Edit Modal */}
      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="flex w-full max-w-lg flex-col rounded-[32px] bg-white shadow-2xl shadow-slate-950/30">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  {editingTemplate ? (
                    <PencilLine className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingTemplate
                      ? "Chỉnh sửa mẫu chứng chỉ"
                      : "Thêm mẫu chứng chỉ mới"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {editingTemplate
                      ? "Cập nhật tên và mô tả cho mẫu chứng chỉ"
                      : "Nhập thông tin cơ bản cho mẫu chứng chỉ mới"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Tên mẫu chứng chỉ <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Mẫu chứng chỉ hiện đại"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Mô tả
                </span>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Mô tả ngắn về phong cách và mục đích sử dụng của mẫu chứng chỉ..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              {editingTemplate ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Trạng thái hiện tại
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {editingTemplate.is_active
                      ? "Đang được sử dụng cho chứng chỉ mới"
                      : "Chưa được kích hoạt"}
                  </p>
                  {editingTemplate.file_url ? (
                    <p className="mt-1 text-xs text-emerald-600">
                      Đã có file mẫu
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
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
                {editingTemplate ? "Lưu thay đổi" : "Tạo mẫu mới"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


