"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileText,
  Filter,
  LoaderCircle,
  Menu,
  PencilLine,
  Save,
  Search,
  Upload,
  Video,
  X,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import { useInstructorSession } from "../_lib/use-instructor-session";
import { getInstructorCourseListRaw } from "../../lib/api_course_instructor";
import type { DocumentType } from "../../lib/api_document";
import {
  deleteOldUploadedFile,
  filterInstructorDocument,
  getDocumentTypeLabel,
  getDocumentTypeOptions,
  getInstructorDocumentList,
  type InstructorDocument,
  type InstructorDocumentFilterState,
  updateInstructorDocument,
  uploadNewDocumentFile,
  validateDocumentFileMatchesType,
} from "../../lib/api_document_instructor";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

const defaultFilters: InstructorDocumentFilterState = {
  keyword: "",
  courseId: "all",
  type: "all",
};

type EditFormState = {
  title: string;
  content: string;
  documentType: DocumentType;
};

export default function InstructorDocumentPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [documents, setDocuments] = useState<InstructorDocument[]>([]);
  const [filters, setFilters] = useState<InstructorDocumentFilterState>(defaultFilters);
  const [selectedDocument, setSelectedDocument] = useState<InstructorDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: "",
    content: "",
    documentType: "pdf",
  });
  const [instructorCourses, setInstructorCourses] = useState<
    Array<{ id: number; title: string }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) {
        return;
      }
      try {
        const [documentList, courseList] = await Promise.all([
          getInstructorDocumentList(currentUser.id),
          getInstructorCourseListRaw(currentUser.id),
        ]);

        if (!isMounted) {
          return;
        }
        setDocuments(documentList);
        setInstructorCourses(courseList.map((course) => ({ id: course.id, title: course.title })));
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách tài liệu của giảng viên.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;
  const filteredDocuments = useMemo(
    () => filterInstructorDocument(documents, filters),
    [documents, filters],
  );
  const documentTypeOptions = getDocumentTypeOptions();

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


  function openEditPanel(document: InstructorDocument) {
    setSelectedDocument(document);
    setSelectedFile(null);
    setEditForm({
      title: document.title,
      content: document.content ?? "",
      documentType: document.document_type,
    });
    setErrorMessage("");
  }

  function closeEditPanel() {
    setSelectedDocument(null);
    setSelectedFile(null);
  }

  function updateFilter(
    key: keyof InstructorDocumentFilterState,
    value: string,
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }

  function updateEditForm<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  async function handleSaveDocument() {
    if (!selectedDocument) {
      return;
    }

    const trimmedTitle = editForm.title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Tên tài liệu không được để trống.");
      return;
    }

    const existingFileValidationError = validateDocumentFileMatchesType(
      editForm.documentType,
      selectedFile?.name ?? selectedDocument.file_url,
    );
    if (existingFileValidationError) {
      setErrorMessage(existingFileValidationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let fileUrl = selectedDocument.file_url;
      let oldFileUrlToDelete: string | null = null;

      if (selectedFile) {
        const uploadResponse = await uploadNewDocumentFile(
          selectedFile,
          editForm.documentType,
        );
        fileUrl = uploadResponse.file_url;
        oldFileUrlToDelete = selectedDocument.file_url;
      }

      const updatedDocument = await updateInstructorDocument(selectedDocument.id, {
        title: trimmedTitle,
        content: editForm.content.trim(),
        document_type: editForm.documentType,
        file_url: fileUrl,
        course_id: selectedDocument.course_id ?? undefined,
        module_id: selectedDocument.module_id ?? undefined,
      });

      if (oldFileUrlToDelete && oldFileUrlToDelete !== fileUrl) {
        await deleteOldUploadedFile(oldFileUrlToDelete);
      }

      setDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.id === selectedDocument.id
            ? {
                ...document,
                ...updatedDocument,
              }
            : document,
        ),
      );

      closeEditPanel();
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
            onClick={() => router.push("/instructor")}
          />
          <div>
            <h1 className="text-lg font-semibold">Tài liệu của giảng viên</h1>
            <p className="text-sm text-slate-500">
              Xem, lọc và cập nhật tài liệu từ các khóa học của mình
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Giảng viên
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
              <span>Đang tải danh sách tài liệu của giảng viên...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-sky-100">Thư viện tài liệu</p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    Danh sách tài liệu từ các khóa học của {user.username}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    Trang này đang bám theo FastAPI ở `document.py` với các route lấy
                    danh sách, cập nhật, tải tệp mới và xóa tệp cũ. Hiện tại dữ liệu
                    vẫn dùng giá trị mẫu để mình hoàn thiện giao diện và luồng chỉnh sửa.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Tổng tài liệu</p>
                    <p className="mt-2 text-base font-semibold">{documents.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Khóa học có tài liệu</p>
                    <p className="mt-2 text-base font-semibold">{instructorCourses.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Kết quả đang hiển thị</p>
                    <p className="mt-2 text-base font-semibold">{filteredDocuments.length}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Bộ lọc tài liệu</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lọc theo từ khóa, khóa học và loại tài liệu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilters(defaultFilters)}
                  className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Filter className="h-4 w-4" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    <span>Từ khóa</span>
                  </span>
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(event) => updateFilter("keyword", event.target.value)}
                    placeholder="Tìm theo tên tài liệu, khóa học hoặc nội dung"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <FileText className="h-4 w-4" />
                    <span>Khóa học</span>
                  </span>
                  <select
                    value={filters.courseId}
                    onChange={(event) => updateFilter("courseId", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả khóa học</option>
                    {instructorCourses.map((course) => (
                      <option key={course.id} value={`${course.id}`}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Video className="h-4 w-4" />
                    <span>Loại tài liệu</span>
                  </span>
                  <select
                    value={filters.type}
                    onChange={(event) => updateFilter("type", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả loại tài liệu</option>
                    {documentTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Danh sách tài liệu</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Chọn một tài liệu để xem trước và chỉnh sửa.
                    </p>
                  </div>
                </div>

                {filteredDocuments.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-400" />
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">
                      Không có tài liệu phù hợp
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Mình chưa tìm thấy tài liệu nào khớp với bộ lọc hiện tại.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {filteredDocuments.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => openEditPanel(document)}
                        className={`w-full rounded-3xl border p-4 text-left transition-colors ${
                          selectedDocument?.id === document.id
                            ? "border-sky-400 bg-sky-50"
                            : "border-slate-200 bg-slate-50/60 hover:border-sky-300 hover:bg-sky-50/70"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                                {getDocumentTypeLabel(document.document_type)}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                                {document.course_name}
                              </span>
                            </div>
                            <h4 className="mt-3 text-lg font-semibold text-slate-900">
                              {document.title}
                            </h4>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                              {document.content || "Chưa có mô tả nội dung cho tài liệu này."}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-sky-700">
                            <Eye className="h-4 w-4" />
                            <span className="text-sm font-medium">Xem và sửa</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </article>

              <aside className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Chỉnh sửa tài liệu</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Khi thay file, hệ thống sẽ kiểm tra loại tệp phải khớp với loại tài liệu.
                    </p>
                  </div>
                  {selectedDocument ? (
                    <button
                      type="button"
                      onClick={closeEditPanel}
                      className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Đóng khung chỉnh sửa"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>

                {selectedDocument ? (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Đang chỉnh sửa</p>
                      <h4 className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedDocument.title}
                      </h4>
                      <p className="mt-2 text-sm text-slate-600">
                        Thuộc khóa học: {selectedDocument.course_name}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Tên tài liệu
                      </span>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(event) => updateEditForm("title", event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Mô tả nội dung
                      </span>
                      <textarea
                        value={editForm.content}
                        onChange={(event) => updateEditForm("content", event.target.value)}
                        rows={5}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Loại tài liệu
                      </span>
                      <select
                        value={editForm.documentType}
                        onChange={(event) =>
                          updateEditForm("documentType", event.target.value as DocumentType)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      >
                        {documentTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-700">Tệp hiện tại</p>
                      <p className="mt-2 break-all text-sm text-slate-600">
                        {selectedDocument.file_url}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Upload className="h-4 w-4" />
                        <span>Thay file tài liệu</span>
                      </span>
                      <input
                        type="file"
                        onChange={(event) =>
                          setSelectedFile(event.target.files?.[0] ?? null)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        PDF chỉ nhận `.pdf`. Video chỉ nhận `.mp4`, `.webm`, `.ogg`.
                        Tài liệu khác nên dùng `.docx`, `.pptx`, `.xlsx`, `.txt`, `.zip`,
                        `.rar`, `.png`, `.jpg`.
                      </p>
                      {selectedFile ? (
                        <p className="mt-2 text-sm text-sky-700">
                          Tệp mới đã chọn: {selectedFile.name}
                        </p>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      onClick={handleSaveDocument}
                      disabled={isSaving}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                        isSaving ? "cursor-not-allowed bg-slate-400" : "bg-sky-600 hover:bg-sky-700"
                      }`}
                    >
                      {isSaving ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>
                        {isSaving ? "Đang lưu thay đổi..." : "Lưu thay đổi tài liệu"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center">
                    <PencilLine className="mx-auto h-8 w-8 text-slate-400" />
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">
                      Chưa chọn tài liệu
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Mình đã chuẩn bị sẵn khung chỉnh sửa. Chỉ cần chọn một tài liệu ở cột bên trái là có thể bắt đầu cập nhật.
                    </p>
                  </div>
                )}
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

