"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  LoaderCircle,
  Menu,
  PencilLine,
  Save,
  Upload,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { NotificationBell } from "../../../components/notification-bell";
import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import { getDocumentById, type CourseDocument, type DocumentType } from "../../../lib/api_document";
import {
  deleteOldUploadedFile,
  updateInstructorDocument,
  uploadNewDocumentFile,
  validateDocumentFileMatchesType,
} from "../../../lib/api_document_instructor";
import VideoEmbed, { isEmbeddableVideoUrl } from "../../../components/video-embed";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

export default function InstructorDocumentDetailPage() {
  const router = useRouter();
  const params = useParams<{ documentId: string }>();
  const documentId = Number(params.documentId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [document, setDocument] = useState<CourseDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualVideoUrl, setManualVideoUrl] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    documentType: "pdf" as DocumentType,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDocument() {
      if (!currentUser) return;
      if (Number.isNaN(documentId) || documentId <= 0) {
        setErrorMessage("Mã tài liệu không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const doc = await getDocumentById(documentId);
        if (!isMounted) return;

        setDocument(doc);
        setEditForm({
          title: doc.title,
          content: doc.content ?? "",
          documentType: doc.document_type,
        });
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải thông tin tài liệu.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadDocument();
    return () => { isMounted = false; };
  }, [documentId, currentUser]);

  const user = currentUser ?? initialUser;

  const documentType = useMemo(() => {
    if (!document) return "other";
    const type = document.document_type?.toLowerCase();
    if (type === "pdf") return "pdf";
    if (type === "video") return "video";
    if (document.file_url?.toLowerCase().endsWith(".pdf")) return "pdf";
    if (isEmbeddableVideoUrl(document.file_url ?? "")) return "video";
    return "other";
  }, [document]);

  const isPdf = documentType === "pdf";
  const isVideo = documentType === "video";

  function updateEditForm<K extends keyof typeof editForm>(
    key: K,
    value: (typeof editForm)[K],
  ) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveDocument() {
    if (!document) return;

    const trimmedTitle = editForm.title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Tên tài liệu không được để trống.");
      return;
    }

    const sourceToValidate = manualVideoUrl || selectedFile?.name || document.file_url;
    const validationError = validateDocumentFileMatchesType(
      editForm.documentType,
      sourceToValidate,
    );
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let fileUrl = document.file_url;
      let oldFileUrlToDelete: string | null = null;

      if (manualVideoUrl) {
        fileUrl = manualVideoUrl.trim();
        oldFileUrlToDelete = document.file_url;
      } else if (selectedFile) {
        const uploadResponse = await uploadNewDocumentFile(
          selectedFile,
          editForm.documentType,
        );
        fileUrl = uploadResponse.file_url;
        oldFileUrlToDelete = document.file_url;
      }

      const updatedDocument = await updateInstructorDocument(document.id, {
        title: trimmedTitle,
        content: editForm.content.trim(),
        document_type: editForm.documentType,
        file_url: fileUrl,
        course_id: document.course_id ?? undefined,
        module_id: document.module_id ?? undefined,
      });

      if (
        oldFileUrlToDelete &&
        oldFileUrlToDelete !== fileUrl &&
        !isEmbeddableVideoUrl(oldFileUrlToDelete)
      ) {
        await deleteOldUploadedFile(oldFileUrlToDelete);
      }

      setDocument({ ...updatedDocument });
      setSelectedFile(null);
      setManualVideoUrl("");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu thay đổi của tài liệu.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isCheckingAuth || !currentUser) {
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
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => router.push("/instructor/document")}
            aria-label="Quay lại danh sách tài liệu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="cursor-pointer"
            onClick={() => router.push("/instructor")}
          />
          <div>
            <h1 className="text-lg font-semibold">Chi tiết tài liệu</h1>
            <p className="text-sm text-slate-500">
              Xem nội dung và chỉnh sửa thông tin tài liệu
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải thông tin tài liệu...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && document ? (
          <div className="space-y-6">
            {/* Document info header */}
            <section className="overflow-hidden rounded-4xl bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 text-white shadow-xl">
              <div className="px-6 py-7">
                <p className="text-sm font-medium text-sky-100">Tài liệu #{document.id}</p>
                <h2 className="mt-2 text-3xl font-semibold">{document.title}</h2>
                {document.content ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-50">
                    {document.content}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium">
                    {isPdf ? "PDF" : isVideo ? "Video" : "Tài liệu khác"}
                  </span>
                  {document.course_id ? (
                    <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium">
                      Khóa học #{document.course_id}
                    </span>
                  ) : null}
                  {document.module_id ? (
                    <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium">
                      Module #{document.module_id}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Document preview */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Xem trước tài liệu</h3>
              <p className="mt-1 text-sm text-slate-500">
                Nội dung tài liệu sẽ hiển thị bên dưới.
              </p>

              <div className="mt-5">
                {isPdf ? (
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <iframe
                      src={document.file_url}
                      className="h-[calc(150vh-260px)] w-full"
                      title={document.title}
                    />
                  </div>
                ) : isVideo ? (
                  <VideoEmbed url={document.file_url} title={document.title} />
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                    <FileText className="mx-auto h-10 w-10 text-slate-400" />
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">
                      Không xem trước được
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Loại tài liệu này không hiển thị trực tiếp trên trang. Bạn có thể mở hoặc tải về.
                    </p>
                    <div className="mt-4 flex justify-center gap-3">
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Mở tài liệu
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Edit panel */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <PencilLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Chỉnh sửa tài liệu</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Cập nhật thông tin, loại tài liệu và tệp đính kèm.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Tên tài liệu</span>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(event) => updateEditForm("title", event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Mô tả nội dung</span>
                  <textarea
                    value={editForm.content}
                    onChange={(event) => updateEditForm("content", event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Loại tài liệu</span>
                  <select
                    value={editForm.documentType}
                    onChange={(event) =>
                      updateEditForm("documentType", event.target.value as DocumentType)
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="pdf">PDF</option>
                    <option value="video">Video</option>
                    <option value="other">Tài liệu khác</option>
                  </select>
                </label>

                {/* Manual video URL input */}
                {editForm.documentType === "video" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800">
                        Nhập liên kết YouTube / Vimeo
                      </p>
                    </div>
                    <input
                      type="url"
                      value={manualVideoUrl}
                      onChange={(event) => {
                        setManualVideoUrl(event.target.value);
                        if (event.target.value) setSelectedFile(null);
                      }}
                      placeholder="https://youtube.com/watch?v=... hoặc https://vimeo.com/..."
                      className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    {manualVideoUrl ? (
                      isEmbeddableVideoUrl(manualVideoUrl) ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Liên kết hợp lệ — video sẽ được nhúng từ nguồn này
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-600">
                          Liên kết không hợp lệ. Chỉ chấp nhận YouTube, Vimeo hoặc tệp .mp4/.webm/.ogg.
                        </p>
                      )
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Khi đã nhập liên kết, tệp tải lên bên dưới sẽ không được sử dụng.
                    </p>
                  </div>
                ) : null}

                {/* File upload */}
                {!manualVideoUrl ? (
                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Upload className="h-4 w-4" />
                      <span>Thay file tài liệu</span>
                    </span>
                    <input
                      type="file"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setManualVideoUrl("");
                      }}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {editForm.documentType === "video"
                        ? "Chỉ nhận .mp4, .webm, .ogg."
                        : "PDF chỉ nhận .pdf. Tài liệu khác nên dùng .docx, .pptx, .xlsx, .txt, .zip, .png, .jpg."}
                    </p>
                    {selectedFile ? (
                      <p className="mt-2 text-sm text-sky-700">Tệp mới đã chọn: {selectedFile.name}</p>
                    ) : null}
                  </label>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3 text-center text-xs text-emerald-700">
                    Đã dùng liên kết thủ công. Bỏ liên kết ở trên nếu muốn tải lên tệp.
                  </div>
                )}

                {/* Current file URL */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Tệp hiện tại</p>
                  <p className="mt-2 break-all text-sm text-slate-600">
                    {document.file_url}
                  </p>
                </div>

                {/* Save button */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDocument}
                    disabled={isSaving}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
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
                    <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
                  </button>
                  <Link
                    href="/instructor/document"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Danh sách tài liệu</span>
                  </Link>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {!isLoading && !errorMessage && !document ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Không tìm thấy tài liệu.
          </div>
        ) : null}
      </section>
    </main>
  );
}
