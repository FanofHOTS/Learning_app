"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  LoaderCircle,
  Menu,
  Plus,
  Trash,
  Upload,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { ShowNavigation } from "../../../lib/app_nav";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import {
  createCourse,
  createCourseComponent,
  createDocument,
  createExam,
  createModule,
  getCategoryList,
  uploadDocumentFile,
  type Category,
} from "../../../lib/api_create_course";

type DocumentType = "pdf" | "video" | "other";

type ComponentType = "document" | "exam" | "video" | "other";

type ComponentDetail = {
  document_type: DocumentType;
  content: string;
  file?: File | null;
  file_url: string;
  exam_description: string;
  duration_minutes: number;
  total_questions: number;
  pass_score: number;
  max_score: number;
};

type ComponentDraft = {
  id: number;
  title: string;
  component_type: ComponentType;
  summary: string;
  estimated_minutes: number;
  is_preview: boolean;
  detail: ComponentDetail;
};

type ModuleDraft = {
  id: number;
  title: string;
  introduction: string;
  total_component: number;
  components: ComponentDraft[];
};

type CourseDraft = {
  title: string;
  category_id: number;
  introduction: string;
  description: string;
  level: string;
  total_module: number;
  image: string;
  imageFile?: File | null;
  is_active: boolean;
  is_public: boolean;
};

const initialCourse: CourseDraft = {
  title: "",
  category_id: 0,
  introduction: "",
  description: "",
  level: "Cơ bản",
  total_module: 1,
  image: "",
  imageFile: null,
  is_active: true,
  is_public: false,
};

const initialModule: ModuleDraft = {
  id: 0,
  title: "Module mới",
  introduction: "",
  total_component: 1,
  components: [
    {
      id: 0,
      title: "Thành phần mới",
      component_type: "document",
      summary: "",
      estimated_minutes: 15,
      is_preview: false,
      detail: {
        document_type: "pdf",
        content: "",
        file: null,
        file_url: "",
        exam_description: "",
        duration_minutes: 30,
        total_questions: 10,
        pass_score: 50,
        max_score: 100,
      },
    },
  ],
};
var modulecount = 1;
var componentcount = 1;

function getDocumentAccept(documentType: DocumentType) {
  if (documentType === "pdf") {
    return ".pdf";
  }
  if (documentType === "video") {
    return "video/*";
  }
  return "*/*";
}

function getComponentTypeLabel(type: ComponentType) {
  if (type === "document") return "Tài liệu";
  if (type === "exam") return "Bài kiểm tra";
  if (type === "video") return "Video";
  return "*/*";
}

export default function CreateCoursePage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [course, setCourse] = useState<CourseDraft>(initialCourse);
  const [modules, setModules] = useState<ModuleDraft[]>([initialModule]);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [selectedComponentIndex, setSelectedComponentIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadStaticData() {
      if (!currentUser) {
        return;
      }
      try {
        const categoryData = await getCategoryList();
        if (!isMounted) return;
        setCategories(categoryData);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu ban đầu.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStaticData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    setCourse((prev) => ({
      ...prev,
      total_module: Math.max(1, modules.length),
    }));
  }, [modules.length]);

  const user = currentUser ?? {
    id: 0,
    username: "Giảng viên",
    email: "giao_vien@example.com",
    icon: "/icon.png",
    role: "instructor",
  };

  const currentModule = modules[selectedModuleIndex] ?? modules[0];
  const currentComponent = currentModule?.components[selectedComponentIndex];

  const componentTypes: ComponentType[] = [
    "document",
    "exam",
    //"video",
    //"other",
  ];

  const courseLevels = ["Cơ bản", "Trung cấp", "Nâng cao"];

  const stepTitle = useMemo(() => {
    if (step === 1) return "Thông tin khóa học";
    if (step === 2) return "Module và thành phần";
    return "Chi tiết thành phần khóa học";
  }, [step]);

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

  function updateCourseField<Field extends keyof CourseDraft>(
    field: Field,
    value: CourseDraft[Field],
  ) {
    setCourse((prev) => ({ ...prev, [field]: value }));
  }

  function updateModule(index: number, field: keyof ModuleDraft, value: any) {
    setModules((prev) =>
      prev.map((module, idx) =>
        idx !== index
          ? module
          : {
              ...module,
              [field]: value,
            },
      ),
    );
  }

  function updateComponent(
    moduleIndex: number,
    componentIndex: number,
    field: keyof ComponentDraft,
    value: any,
  ) {
    setModules((prev) =>
      prev.map((module, mIndex) =>
        mIndex !== moduleIndex
          ? module
          : {
              ...module,
              components: module.components.map((component, cIndex) =>
                cIndex !== componentIndex
                  ? component
                  : {
                      ...component,
                      [field]: value,
                    },
              ),
            },
      ),
    );
  }

  function updateComponentDetail(
    moduleIndex: number,
    componentIndex: number,
    field: keyof ComponentDetail,
    value: any,
  ) {
    setModules((prev) =>
      prev.map((module, mIndex) =>
        mIndex !== moduleIndex
          ? module
          : {
              ...module,
              components: module.components.map((component, cIndex) =>
                cIndex !== componentIndex
                  ? component
                  : {
                      ...component,
                      detail: {
                        ...component.detail,
                        [field]: value,
                      },
                    },
              ),
            },
      ),
    );
  }

  function addModule() {
    setModules((prev) => [
      ...prev,
      {
        id: modulecount,
        title: `Module mới`,
        introduction: "",
        total_component: 1,
        components: [
          {
            id: componentcount,
            title: "Thành phần mới",
            component_type: "document",
            summary: "",
            estimated_minutes: 15,
            is_preview: false,
            detail: {
              document_type: "pdf",
              content: "",
              file: null,
              file_url: "",
              exam_description: "",
              duration_minutes: 30,
              total_questions: 10,
              pass_score: 50,
              max_score: 100,
            },
          },
        ],
      },
    ]);
    modulecount = modulecount + 1;
    componentcount = componentcount + 1;
  }

  function addComponent(moduleIndex: number) {
    setModules((prev) =>
      prev.map((module, idx) =>
        idx !== moduleIndex
          ? module
          : {
              ...module,
              components: [
                ...module.components,
                {
                  id: componentcount,
                  title: `Thành phần mới`,
                  component_type: "document",
                  summary: "",
                  estimated_minutes: 15,
                  is_preview: false,
                  detail: {
                    document_type: "pdf",
                    content: "",
                    file: null,
                    file_url: "",
                    exam_description: "",
                    duration_minutes: 30,
                    total_questions: 10,
                    pass_score: 50,
                    max_score: 100,
                  },
                },
              ],
            },
      ),
    );
    componentcount = componentcount + 1;
  }

  function removeModule(index: number) {
    if (modules.length <= 1) return; // Ít nhất 1 module
    setModules((prev) => prev.filter((_, idx) => idx !== index));
    if (selectedModuleIndex >= modules.length - 1) {
      setSelectedModuleIndex(Math.max(0, modules.length - 2));
    }
  }

  function removeComponent(moduleIndex: number, componentIndex: number) {
    setModules((prev) =>
      prev.map((module, mIdx) =>
        mIdx !== moduleIndex
          ? module
          : {
              ...module,
              components: module.components.filter((_, cIdx) => cIdx !== componentIndex),
            }
      )
    );
    if (selectedComponentIndex >= modules[moduleIndex].components.length - 1) {
      setSelectedComponentIndex(Math.max(0, modules[moduleIndex].components.length - 2));
    }
  }

  function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    moduleIndex: number,
    componentIndex: number,
  ) {
    const file = event.target.files?.[0] ?? null;
    updateComponentDetail(moduleIndex, componentIndex, "file", file);
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateCourseField("imageFile", file);
  }

  function validateStepTwo() {
    if (!course.title.trim()) {
      setErrorMessage("Vui lòng nhập tiêu đề khóa học.");
      return false;
    }
    if (!course.category_id) {
      setErrorMessage("Vui lòng chọn phân loại khóa học.");
      return false;
    }
    if (!course.introduction.trim()) {
      setErrorMessage("Vui lòng nhập dòng giới thiệu ngắn về khóa học.");
      return false;
    }
    if (!course.description.trim()) {
      setErrorMessage("Vui lòng nhập mô tả chi tiết về khóa học.");
      return false;
    }
    if (modules.length === 0) {
      setErrorMessage("Vui lòng thêm ít nhất một module.");
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    setErrorMessage("");
    setSuccessMessage("");
    if (!currentUser) {
      setErrorMessage("Không có thông tin giảng viên để tạo khóa học.");
      return;
    }

    setIsSubmitting(true);
    try {
      for (const moduleCheck of modules) {
        if(!moduleCheck.title.trim()){
          throw new Error(
            `Vui lòng nhập đầu đủ tiêu đề cho các Module`
          );
        }
        if(!moduleCheck.introduction.trim()){
          throw new Error(
            `Vui lòng nhập dòng giới thiệu cho Module ${moduleCheck.title.trim()}`
          );
        }
        if(moduleCheck.components.length === 0){
          throw new Error(
            `Vui lòng thêm ít nhất một thành phần cho Module ${moduleCheck.title.trim()}`
          );
        }
        for (const componentCheck of moduleCheck.components) {
          if(!componentCheck.title.trim()){
            throw new Error(
              `Vui lòng nhập đầu đủ tiêu đề cho các thành phần khóa học`
            );
          }
          if(!componentCheck.summary.trim()){
            throw new Error(
              `Vui lòng nhập phần mô tả, tóm tắt cho thành phần khóa học ${componentCheck.title.trim()}`
            );
          }
          if(!componentCheck.estimated_minutes){
            throw new Error(
              `Vui lòng nhập thời gian dự kiến cho thành phần khóa học ${componentCheck.title.trim()}`
            );
          }
          if (componentCheck.component_type === "document" && !componentCheck.detail.file) {
            throw new Error(
              `Vui lòng tải tệp cho phần tài liệu ${componentCheck.title} trong ${moduleCheck.title}`
            );
          }
          if (componentCheck.component_type === "exam" && !componentCheck.detail.duration_minutes) {
            throw new Error(
              `Vui lòng nhập thời gian làm bài cho phần bài kiểm tra ${componentCheck.title} trong ${moduleCheck.title}`
            );
          }
          if (componentCheck.component_type === "exam" && !componentCheck.detail.total_questions) {
            throw new Error(
              `Vui lòng nhập số lượng câu hỏi dự kiến cho phần bài kiểm tra ${componentCheck.title} trong ${moduleCheck.title}`
            );
          }
          if (componentCheck.component_type === "exam" && !componentCheck.detail.pass_score) {
            throw new Error(
              `Vui lòng nhập số điểm đạt cho phần bài kiểm tra ${componentCheck.title} trong ${moduleCheck.title}`
            );
          }
          if (componentCheck.component_type === "exam" && !componentCheck.detail.max_score) {
            throw new Error(
              `Vui lòng nhập số điểm tối đa cho phần bài kiểm tra ${componentCheck.title} trong ${moduleCheck.title}`
            );
          }
        }
      }

      let imageUrl = course.image;
      if (course.imageFile) {
        const uploadResult = await uploadDocumentFile(course.imageFile, "other");
        imageUrl = uploadResult.file_url;
      }
      else {
        imageUrl = "/logo.png";
      }

      const createdCourse = await createCourse({
        title: course.title,
        category_id: course.category_id,
        instructor_id: currentUser.id,
        introduction: course.introduction,
        description: course.description,
        level: course.level,
        total_module: modules.length,
        image: imageUrl,
        is_active: course.is_active,
        is_public: course.is_public,
      });

      for (const [moduleIndex, module] of modules.entries()) {
        const createdModule = await createModule({
          course_id: createdCourse.id,
          title: module.title,
          module_sequence: moduleIndex + 1,
          type: "Học liệu",
          introduction: module.introduction,
          total_component: module.components.length,
        });

        for (const [componentIndex, component] of module.components.entries()) {
          let refId: number | null = null;

          if (component.component_type === "document") {
            if (!component.detail.file) {
              throw new Error(
                `Vui lòng tải tệp cho phần tài liệu ${component.title} trong ${module.title}`,
              );
            }
            const uploadResult = await uploadDocumentFile(
              component.detail.file,
              component.detail.document_type,
            );
            const documentResult = await createDocument({
              title: component.title,
              document_type: component.detail.document_type,
              content: component.detail.content,
              file_url: uploadResult.file_url,
              course_id: createdCourse.id,
              module_id: createdModule.id,
            });
            refId = documentResult.id;
          }

          if (component.component_type === "exam") {
            const examResult = await createExam({
              title: component.title,
              description: component.detail.exam_description,
              course_id: createdCourse.id,
              module_id: createdModule.id,
              duration_minutes: component.detail.duration_minutes,
              total_questions: component.detail.total_questions,
              pass_score: component.detail.pass_score,
              max_score: component.detail.max_score,
              is_active: true,
            });
            refId = examResult.id;
          }

          await createCourseComponent({
            course_id: createdCourse.id,
            module_id: createdModule.id,
            title: component.title,
            component_sequence: componentIndex + 1,
            component_type: component.component_type,
            ref_id: refId,
            summary: component.summary,
            estimated_minutes: component.estimated_minutes,
            is_preview: component.is_preview,
          });
        }
      }

      setSuccessMessage("Tạo khóa học thành công. Bạn có thể quay lại trang giảng viên. Nếu muốn hoàn thiện các bài kiểm tra thì hãy vào trang danh sách các bài kiểm tra");
      setStep(1);
      setModules([initialModule]);
      setCourse(initialCourse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Có lỗi khi gửi thông tin tạo khóa học.",
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
            <h1 className="text-lg font-semibold">Tạo khóa học mới</h1>
            <p className="text-sm text-slate-500">
              Hướng dẫn giảng viên nhập thông tin khóa học, module và thành phần.
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "instructor" ? "Giảng viên" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-24 max-w-7xl px-4 pb-16">
        {isLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Bước {step} trên 3</p>
                  <h2 className="text-2xl font-semibold text-slate-900">{stepTitle}</h2>
                </div>
                <div className="rounded-3xl bg-slate-100 px-4 py-3 text-center text-slate-700">
                  <p className="text-xs uppercase text-slate-500">Số module</p>
                  <p className="mt-2 text-sm font-semibold">{modules.length}</p>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
                {errorMessage}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            {step === 1 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Tiêu đề khóa học</span>
                    <input
                      type="text"
                      value={course.title}
                      onChange={(event) =>
                        updateCourseField("title", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Phân loại khóa học</span>
                    <select
                      value={course.category_id}
                      onChange={(event) =>
                        updateCourseField(
                          "category_id",
                          Number(event.target.value),
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <option value={0}>Chọn phân loại</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Giới thiệu ngắn</span>
                    <input
                      type="text"
                      value={course.introduction}
                      onChange={(event) =>
                        updateCourseField("introduction", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Trình độ</span>
                    <select
                      value={course.level}
                      onChange={(event) =>
                        updateCourseField("level", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                    >
                      {courseLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Mô tả chi tiết</span>
                    <textarea
                      value={course.description}
                      onChange={(event) =>
                        updateCourseField("description", event.target.value)
                      }
                      rows={5}
                      className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                    />
                  </label>

                  <div className="space-y-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      <span>Ảnh đại diện</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-sm text-slate-700"
                      />
                    </label>
                    {course.imageFile ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          <span>{course.imageFile.name}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={course.is_active}
                          onChange={(event) =>
                            updateCourseField("is_active", event.target.checked)
                          }
                        />
                        <span>Kích hoạt khóa học</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={course.is_public}
                          onChange={(event) =>
                            updateCourseField("is_public", event.target.checked)
                          }
                        />
                        <span>Công khai khóa học</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {modules.map((module, moduleIndex) => (
                  <div
                    key={module.id}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Module {moduleIndex + 1}</p>
                        <h3 className="text-xl font-semibold text-slate-900">
                          {module.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedModuleIndex(moduleIndex)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <BookOpen className="h-4 w-4" />
                          Chọn module
                        </button>
                        {modules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeModule(moduleIndex)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Tiêu đề module</span>
                        <input
                          type="text"
                          value={module.title}
                          onChange={(event) =>
                            updateModule(moduleIndex, "title", event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Giới thiệu module</span>
                        <input
                          type="text"
                          value={module.introduction}
                          onChange={(event) =>
                            updateModule(moduleIndex, "introduction", event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Số thành phần trong module</span>
                        <input
                          type="number"
                          min={1}
                          value={module.components.length}
                          readOnly
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => addComponent(moduleIndex)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        <Plus className="h-4 w-4" />
                        Thêm thành phần
                      </button>
                    </div>

                    <div className="space-y-4">
                      {module.components.map((component, componentIndex) => (
                        <div
                          key={component.id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm text-slate-500">
                                Thành phần {componentIndex + 1}
                              </p>
                              <h4 className="text-lg font-semibold text-slate-900">
                                {component.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedModuleIndex(moduleIndex);
                                  setSelectedComponentIndex(componentIndex);
                                  setStep(3);
                                }}
                                className="inline-flex items-center gap-2 rounded-2xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-200"
                              >
                                <ArrowRight className="h-4 w-4" />
                                Chi tiết
                              </button>
                              {module.components.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeComponent(moduleIndex, componentIndex)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <label className="space-y-2 text-sm text-slate-700">
                              <span>Tên thành phần</span>
                              <input
                                type="text"
                                value={component.title}
                                onChange={(event) =>
                                  updateComponent(
                                    moduleIndex,
                                    componentIndex,
                                    "title",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                              />
                            </label>
                            <label className="space-y-2 text-sm text-slate-700">
                              <span>Loại thành phần</span>
                              <select
                                value={component.component_type}
                                onChange={(event) =>
                                  updateComponent(
                                    moduleIndex,
                                    componentIndex,
                                    "component_type",
                                    event.target.value as ComponentType,
                                  )
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                              >
                                {componentTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {getComponentTypeLabel(type)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <label className="space-y-2 text-sm text-slate-700">
                              <span>Tóm tắt / mô tả</span>
                              <input
                                type="text"
                                value={component.summary}
                                onChange={(event) =>
                                  updateComponent(
                                    moduleIndex,
                                    componentIndex,
                                    "summary",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                              />
                            </label>
                            <label className="space-y-2 text-sm text-slate-700">
                              <span>Thời lượng dự kiến (phút)</span>
                              <input
                                type="number"
                                min={1}
                                value={component.estimated_minutes}
                                onChange={(event) =>
                                  updateComponent(
                                    moduleIndex,
                                    componentIndex,
                                    "estimated_minutes",
                                    Number(event.target.value),
                                  )
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                              />
                            </label>
                          </div>

                          <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={component.is_preview}
                              onChange={(event) =>
                                updateComponent(
                                  moduleIndex,
                                  componentIndex,
                                  "is_preview",
                                  event.target.checked,
                                )
                              }
                            />
                            Cho phép xem thử
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addModule}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  Thêm module mới
                </button>
              </div>
            )}

            {step === 3 && currentComponent ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{currentModule.title}</p>
                      <h3 className="text-xl font-semibold text-slate-900">
                        Chi tiết: {currentComponent.title}
                      </h3>
                    </div>
                    <div className="rounded-3xl bg-slate-100 px-4 py-3 text-slate-700">
                      <p className="text-xs uppercase text-slate-500">Loại</p>
                      <p className="mt-2 text-sm font-semibold">
                        {getComponentTypeLabel(currentComponent.component_type)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-700">
                      <span>Chọn module</span>
                      <select
                        value={selectedModuleIndex}
                        onChange={(event) => {
                          setSelectedModuleIndex(Number(event.target.value));
                          setSelectedComponentIndex(0);
                        }}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                      >
                        {modules.map((module, index) => (
                          <option key={module.id} value={index}>
                            {module.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span>Chọn thành phần</span>
                      <select
                        value={selectedComponentIndex}
                        onChange={(event) =>
                          setSelectedComponentIndex(Number(event.target.value))
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                      >
                        {currentModule.components.map((component, index) => (
                          <option key={component.id} value={index}>
                            {component.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {currentComponent.component_type === "document" ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Loại tài liệu</span>
                        <select
                          value={currentComponent.detail.document_type}
                          onChange={(event) =>
                            updateComponentDetail(
                              selectedModuleIndex,
                              selectedComponentIndex,
                              "document_type",
                              event.target.value as DocumentType,
                            )
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        >
                          <option value="pdf">PDF</option>
                          <option value="video">Video</option>
                          <option value="other">Khác</option>
                        </select>
                      </label>

                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Nội dung mô tả</span>
                        <textarea
                          rows={4}
                          value={currentComponent.detail.content}
                          onChange={(event) =>
                            updateComponentDetail(
                              selectedModuleIndex,
                              selectedComponentIndex,
                              "content",
                              event.target.value,
                            )
                          }
                          className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>
                    </div>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span>Tải tệp lên</span>
                      <input
                        type="file"
                        accept={getDocumentAccept(
                          currentComponent.detail.document_type,
                        )}
                        onChange={(event) =>
                          handleFileUpload(event, selectedModuleIndex, selectedComponentIndex)
                        }
                        className="w-full text-sm text-slate-700"
                      />
                    </label>
                    {currentComponent.detail.file ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          <span>{currentComponent.detail.file.name}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : currentComponent.component_type === "exam" ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Mô tả đề thi</span>
                        <textarea
                          rows={4}
                          value={currentComponent.detail.exam_description}
                          onChange={(event) =>
                            updateComponentDetail(
                              selectedModuleIndex,
                              selectedComponentIndex,
                              "exam_description",
                              event.target.value,
                            )
                          }
                          className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span>Thời lượng (phút)</span>
                          <input
                            type="number"
                            min={1}
                            value={currentComponent.detail.duration_minutes}
                            onChange={(event) =>
                              updateComponentDetail(
                                selectedModuleIndex,
                                selectedComponentIndex,
                                "duration_minutes",
                                Number(event.target.value),
                              )
                            }
                            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-slate-700">
                          <span>Số câu hỏi</span>
                          <input
                            type="number"
                            min={1}
                            value={currentComponent.detail.total_questions}
                            onChange={(event) =>
                              updateComponentDetail(
                                selectedModuleIndex,
                                selectedComponentIndex,
                                "total_questions",
                                Number(event.target.value),
                              )
                            }
                            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Điểm đạt</span>
                        <input
                          type="number"
                          min={0}
                          max={currentComponent.detail.max_score}
                          value={currentComponent.detail.pass_score}
                          onChange={(event) =>
                            updateComponentDetail(
                              selectedModuleIndex,
                              selectedComponentIndex,
                              "pass_score",
                              Number(event.target.value),
                            )
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-slate-700">
                        <span>Điểm tối đa</span>
                        <input
                          type="number"
                          min={1}
                          value={currentComponent.detail.max_score}
                          onChange={(event) =>
                            updateComponentDetail(
                              selectedModuleIndex,
                              selectedComponentIndex,
                              "max_score",
                              Number(event.target.value),
                            )
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-slate-700">
                    <p className="text-sm">
                      Loại thành phần này không yêu cầu thông tin chi tiết đặc thù. Bạn có thể quay lại bước trước nếu muốn thay đổi loại.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => router.push("/instructor")}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Quay lại trang giảng viên
              </button>

              <div className="flex flex-wrap items-center gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại
                  </button>
                ) : null}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1 && !validateStepTwo()) return;
                      setErrorMessage("");
                      setStep(step + 1);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Tiếp theo
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Gửi thông tin tạo khóa học
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
