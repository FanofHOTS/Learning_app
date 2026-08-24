"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  FileImage,
  GripVertical,
  LoaderCircle,
  Menu,
  Plus,
  Save,
  Sparkles,
  Trash,
} from "lucide-react";
import { UserAccountMenu } from "../../../../components/user-account-menu";
import { NotificationBell } from "../../../../components/notification-bell";
import { ShowNavigation } from "../../../../lib/app_nav";
import { useInstructorSession } from "../../../_lib/use-instructor-session";
import {
  getInstructorCourseDetail,
  updateInstructorCourse,
  getInstructorCourseCategories,
  validateInstructorCourseUpdate,
  uploadInstructorCourseImage,
  deleteOldInstructorCourseImage,
  shouldDeleteUploadedCourseImage,
  validateCourseImageFile,
  getInstructorPrerequisiteCourses,
  type InstructorCourseUpdateInput,
  type InstructorCourseDetail,
  type CourseCategoryOption,
} from "../../../../lib/api_course_instructor";
import {
  getCourseExtraData,
  updateCourseExtraData,
  createCourseExtraData,
  listCourseExtraData,
  type CourseExtraDataResponse,
} from "../../../../lib/api_course_extra_data";
import {
  getDocumentById,
  deleteDocument,
  type CourseDocument,
  type DocumentType,
} from "../../../../lib/api_document";
import {
  updateInstructorDocument,
  uploadNewDocumentFile,
} from "../../../../lib/api_document_instructor";
import {
  getExamById,
  deleteExam,
  type Exam,
} from "../../../../lib/api_exam";
import {
  updateInstructorExam,
} from "../../../../lib/api_exam_instructor";
import {
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  type Assignment,
} from "../../../../lib/api_assignment";
import type { FastAPICourse } from "../../../../lib/api_course";
import type { User } from "../../../../lib/api_user";
import {
  createModule,
  createCourseComponent,
  createDocument,
  createExam,
  createAssignment,
  uploadDocumentFile,
  type ModuleCreatePayload,
  type CourseComponentCreatePayload,
} from "../../../../lib/api_create_course";
import { isEmbeddableVideoUrl } from "../../../../components/video-embed";
import BloomObjectives from "../_bloom-objectives";
import BloomGapAlert from "../_bloom-gap-alert";
import AssessmentMatrix from "../_assessment-matrix";
import ContentStructure from "../_content-structure";
import { mergeMatrixIntoStructure, mergeStructureIntoMatrix } from "../_bloom-sync";
import type {
  InstructorCourseComponent,
  InstructorCourseModule,
} from "../../../../lib/api_course_instructor";
import {
  updateModule as updateModuleApi,
  deleteModule as deleteModuleApi,
  updateCourseComponent as updateCourseComponentApi,
  deleteCourseComponent as deleteCourseComponentApi,
} from "../../../../lib/api_course_instructor";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

type CourseFormState = {
  title: string;
  introduction: string;
  description: string;
  category_id: number;
  level: string;
  total_student: number;
  image: string;
};

function getComponentTypeLabel(type: string) {
  if (type === "document") return "Tài liệu";
  if (type === "exam") return "Bài kiểm tra";
  if (type === "assignment") return "Bài tập";
  return type;
}

export default function InstructorCourseUpdatePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExtraData, setIsSavingExtraData] = useState(false);
  const [isSavingModules, setIsSavingModules] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();

  const [courseDetail, setCourseDetail] = useState<InstructorCourseDetail | null>(null);
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);
  const [courseExtraData, setCourseExtraData] = useState<CourseExtraDataResponse | null>(null);
  const [prerequisiteCourses, setPrerequisiteCourses] = useState<FastAPICourse[]>([]);
  const [requiredCourseMap, setRequiredCourseMap] = useState<Map<number, number | null>>(new Map());

  // Local editable state for modules & components
  const [localModules, setLocalModules] = useState<InstructorCourseModule[]>([]);
  const [localComponents, setLocalComponents] = useState<InstructorCourseComponent[]>([]);

  // Form state for basic info
  const [form, setForm] = useState<CourseFormState | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("/logo.png");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) return;
      try {
        if (!courseId || Number.isNaN(courseId)) {
          throw new Error("Mã khóa học không hợp lệ.");
        }

        const [detail, cats, extraData, prereqs, allExtraData] = await Promise.all([
          getInstructorCourseDetail(courseId),
          getInstructorCourseCategories(),
          getCourseExtraData(courseId),
          getInstructorPrerequisiteCourses(currentUser.id),
          listCourseExtraData(),
        ]);

        if (!isMounted) return;

        setCourseDetail(detail);
        setCategories(cats);
        setCourseExtraData(extraData);
        setPrerequisiteCourses(prereqs);
        setForm({
          title: detail.title,
          introduction: detail.introduction,
          description: detail.description,
          category_id: detail.category_id,
          level: detail.level,
          total_student: detail.total_student,
          image: detail.image,
        });
        setPreviewImageUrl(detail.image || "/logo.png");

        // Prerequisite chain map for cycle detection
        const prereqMap = new Map<number, number | null>();
        for (const ed of allExtraData) {
          prereqMap.set(ed.course_id, ed.required_course_id);
        }
        setRequiredCourseMap(prereqMap);

        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Không thể tải dữ liệu khóa học.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [courseId, currentUser]);

  // Initialize local modules & components when courseDetail loads
  useEffect(() => {
    if (courseDetail) {
      setLocalModules(
        [...courseDetail.modules].sort((a, b) => a.module_sequence - b.module_sequence),
      );
      setLocalComponents(
        [...courseDetail.components].sort((a, b) => {
          if (a.module_id !== b.module_id) return a.module_id - b.module_id;
          return a.component_sequence - b.component_sequence;
        }),
      );
    }
  }, [courseDetail]);

  // Image preview
  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewImageUrl(form?.image || "/logo.png");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewImageUrl(objectUrl);
    return () => { URL.revokeObjectURL(objectUrl); };
  }, [form?.image, selectedImageFile]);

  const user = currentUser ?? initialUser;

  // Derived modules & components từ local state cho extra data components
  const components = useMemo(() => {
    return [...localComponents].sort((left, right) => {
      if (left.module_id !== right.module_id) return left.module_id - right.module_id;
      return left.component_sequence - right.component_sequence;
    });
  }, [localComponents]);

  const modules = useMemo(() => {
    return [...localModules].sort(
      (left, right) => left.module_sequence - right.module_sequence,
    );
  }, [localModules]);

  const updateForm = useCallback(<K extends keyof CourseFormState>(
    key: K,
    value: CourseFormState[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  async function handleSaveBasicInfo() {
    if (!courseDetail || !form) return;

    if (selectedImageFile) {
      const msg = validateCourseImageFile(selectedImageFile.name);
      if (msg) { setErrorMessage(msg); return; }
    }

    const payload: InstructorCourseUpdateInput = {
      title: form.title,
      category_id: form.category_id,
      instructor_id: courseDetail.instructor_id,
      introduction: form.introduction,
      description: form.description,
      level: form.level,
      total_module: localModules.length,
      total_student: form.total_student,
      image: form.image.trim(),
      is_active: courseDetail.is_active,
      is_public: courseDetail.is_public,
    };

    const validationMsg = validateInstructorCourseUpdate(payload);
    if (validationMsg) { setErrorMessage(validationMsg); return; }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let nextImageUrl = form.image.trim();
      let oldImageUrlToDelete: string | null = null;

      if (selectedImageFile) {
        const uploaded = await uploadInstructorCourseImage(selectedImageFile);
        nextImageUrl = uploaded.file_url;
        if (courseDetail.image !== nextImageUrl && shouldDeleteUploadedCourseImage(courseDetail.image)) {
          oldImageUrlToDelete = courseDetail.image;
        }
      }

      const saved = await updateInstructorCourse(courseDetail.id, { ...payload, image: nextImageUrl });
      if (oldImageUrlToDelete) await deleteOldInstructorCourseImage(oldImageUrlToDelete);

      setCourseDetail((prev) =>
        prev ? { ...prev, ...saved, image: saved.image, updated_at_text: "Vừa cập nhật xong" } : prev,
      );
      setForm((prev) => (prev ? { ...prev, image: saved.image } : prev));
      setSelectedImageFile(null);
      setPreviewImageUrl(saved.image || "/logo.png");
      setSuccessMessage("✅ Thông tin cơ bản đã được lưu.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể lưu thông tin khóa học.");
    } finally {
      setIsSaving(false);
    }
  }

    // Component detail state: expanded components + detail field data
  const [expandedComponentIds, setExpandedComponentIds] = useState<Set<number>>(new Set());
  const [componentDetailDocs, setComponentDetailDocs] = useState<Map<number, CourseDocument>>(new Map());
  const [componentDetailExams, setComponentDetailExams] = useState<Map<number, Exam>>(new Map());
  const [componentDetailAssignments, setComponentDetailAssignments] = useState<
    Map<number, Assignment>
  >(new Map());
  const [componentDetailFiles, setComponentDetailFiles] = useState<Map<number, File | null>>(new Map());

  // Load referenced document/exam/assignment data when components are initialized
  useEffect(() => {
    if (courseDetail && localComponents.length > 0) {
      const loadDetails = async () => {
        const docMap = new Map<number, CourseDocument>();
        const examMap = new Map<number, Exam>();
        const assignMap = new Map<number, Assignment>();

        await Promise.all(
          localComponents.map(async (c) => {
            if (!c.ref_id || c.ref_id <= 0) return;
            try {
              if (c.component_type === "document") {
                const doc = await getDocumentById(c.ref_id);
                docMap.set(c.id, doc);
              } else if (c.component_type === "exam") {
                const exam = await getExamById(c.ref_id);
                examMap.set(c.id, exam);
              } else if (c.component_type === "assignment") {
                const assign = await getAssignmentById(c.ref_id);
                assignMap.set(c.id, assign);
              }
            } catch {
              // Silently skip if not found (e.g. new components with no ref yet)
            }
          }),
        );

        setComponentDetailDocs(docMap);
        setComponentDetailExams(examMap);
        setComponentDetailAssignments(assignMap);
      };
      loadDetails();
    }
  }, [courseDetail, localComponents]);

  // ─── Undo / Redo state ───
  type Snapshot = {
    modules: InstructorCourseModule[];
    components: InstructorCourseComponent[];
  };
  const MAX_UNDO = 30;
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  function pushUndoSnapshot() {
    lastEditSnapshotRef.current = Date.now();
    setUndoStack((prev) => {
      const next = [
        ...prev,
        {
          modules: localModules.map((m) => ({ ...m })),
          components: localComponents.map((c) => ({ ...c })),
        },
      ];
      if (next.length > MAX_UNDO) next.shift();
      return next;
    });
    setRedoStack([]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      {
        modules: localModules.map((m) => ({ ...m })),
        components: localComponents.map((c) => ({ ...c })),
      },
    ]);
    setUndoStack((prev) => prev.slice(0, -1));
    setLocalModules(snapshot.modules);
    setLocalComponents(snapshot.components);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [
      ...prev,
      {
        modules: localModules.map((m) => ({ ...m })),
        components: localComponents.map((c) => ({ ...c })),
      },
    ]);
    setRedoStack((prev) => prev.slice(0, -1));
    setLocalModules(snapshot.modules);
    setLocalComponents(snapshot.components);
  }

  // Throttle snapshot cho edit operations (text input change)
  const lastEditSnapshotRef = useRef(0);

  function pushUndoSnapshotForEdit() {
    const now = Date.now();
    if (now - lastEditSnapshotRef.current > 2000) {
      pushUndoSnapshot();
      lastEditSnapshotRef.current = now;
    }
  }

  // Keyboard shortcut: Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoStack, redoStack, localModules, localComponents]);

  // ─── Drag-and-drop state ───
  const [dragModuleIndex, setDragModuleIndex] = useState<number | null>(null);
  const [dragOverModuleIndex, setDragOverModuleIndex] = useState<number | null>(null);
  const [dragCompKey, setDragCompKey] = useState<string | null>(null);
  const [dragOverCompKey, setDragOverCompKey] = useState<string | null>(null);

  function handleModuleDragStart(index: number) {
    pushUndoSnapshot();
    setDragModuleIndex(index);
  }

  function handleModuleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragModuleIndex !== null && dragModuleIndex !== index) {
      setDragOverModuleIndex(index);
    }
  }

  function handleModuleDragEnd() {
    if (dragModuleIndex !== null && dragOverModuleIndex !== null && dragModuleIndex !== dragOverModuleIndex) {
      setLocalModules((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragModuleIndex, 1);
        next.splice(dragOverModuleIndex, 0, moved);
        return next;
      });
    }
    setDragModuleIndex(null);
    setDragOverModuleIndex(null);
  }

  function handleCompDragStart(moduleId: number, componentId: number) {
    pushUndoSnapshot();
    setDragCompKey(`${moduleId}:${componentId}`);
  }

  function handleCompDragOver(e: React.DragEvent, moduleId: number, componentId: number) {
    e.preventDefault();
    const targetKey = `${moduleId}:${componentId}`;
    if (dragCompKey && dragCompKey !== targetKey) {
      setDragOverCompKey(targetKey);
    }
  }

  function handleCompDragEnd() {
    if (dragCompKey && dragOverCompKey && dragCompKey !== dragOverCompKey) {
      const [srcModuleId, srcCompId] = dragCompKey.split(":").map(Number);
      const [tgtModuleId, tgtCompId] = dragOverCompKey.split(":").map(Number);

      if (srcModuleId === tgtModuleId) {
        // Reorder within same module and recalculate component_sequence
        setLocalComponents((prev) => {
          const srcIndex = prev.findIndex((c) => c.id === srcCompId);
          const tgtIndex = prev.findIndex((c) => c.id === tgtCompId);
          if (srcIndex === -1 || tgtIndex === -1) return prev;
          const next = [...prev];
          const [moved] = next.splice(srcIndex, 1);
          const adjustedTgt = tgtIndex > srcIndex ? tgtIndex - 1 : tgtIndex;
          next.splice(adjustedTgt, 0, moved);
          // Recalculate component_sequence for all components in this module
          let seq = 1;
          return next.map((c) => {
            if (c.module_id !== srcModuleId) return c;
            return { ...c, component_sequence: seq++ };
          });
        });
      } else {
        // Cross-module drag: move component to target module
        setLocalComponents((prev) => {
          const srcIndex = prev.findIndex((c) => c.id === srcCompId);
          const tgtIndex = prev.findIndex((c) => c.id === tgtCompId);
          if (srcIndex === -1 || tgtIndex === -1) return prev;

          const next = [...prev];
          const [moved] = next.splice(srcIndex, 1);
          const adjustedTgt = tgtIndex > srcIndex ? tgtIndex - 1 : tgtIndex;

          // Update module_id to target module
          const updatedMoved = { ...moved, module_id: tgtModuleId };
          next.splice(adjustedTgt, 0, updatedMoved);

          // Recalculate component_sequence for both source and target modules
          let srcSeq = 1;
          let tgtSeq = 1;
          return next.map((c) => {
            if (c.module_id === srcModuleId) {
              return { ...c, component_sequence: srcSeq++ };
            }
            if (c.module_id === tgtModuleId) {
              return { ...c, component_sequence: tgtSeq++ };
            }
            return c;
          });
        });

        // Update total_component counts on both modules
        setLocalModules((prev) =>
          prev.map((m) => {
            if (m.id === srcModuleId) {
              return { ...m, total_component: Math.max(0, m.total_component - 1) };
            }
            if (m.id === tgtModuleId) {
              return { ...m, total_component: m.total_component + 1 };
            }
            return m;
          }),
        );
      }
    }
    setDragCompKey(null);
    setDragOverCompKey(null);
  }

  function getModuleDragStyle(index: number): string {
    if (dragOverModuleIndex === index && dragModuleIndex !== index) {
      return "ring-2 ring-violet-400 ring-offset-2 opacity-60";
    }
    if (dragModuleIndex === index) {
      return "opacity-50";
    }
    return "";
  }

  function getCompDragStyle(moduleId: number, componentId: number): string {
    const key = `${moduleId}:${componentId}`;
    if (dragOverCompKey === key && dragCompKey !== key) {
      return "ring-2 ring-violet-400 ring-offset-2 opacity-60";
    }
    if (dragCompKey === key) {
      return "opacity-50";
    }
    return "";
  }

  // ─── Module / Component CRUD handlers ───

  function updateLocalModule(index: number, field: keyof InstructorCourseModule, value: unknown) {
    pushUndoSnapshotForEdit();
    setLocalModules((prev) =>
      prev.map((m, i) => (i !== index ? m : { ...m, [field]: value })),
    );
  }

  function updateLocalComponent(
    moduleIndex: number,
    componentIndex: number,
    field: keyof InstructorCourseComponent,
    value: unknown,
  ) {
    pushUndoSnapshotForEdit();
    const targetModule = localModules[moduleIndex];
    if (!targetModule) return;
    const componentList = localComponents.filter((c) => c.module_id === targetModule.id);
    const targetComponent = componentList[componentIndex];
    if (!targetComponent) return;

    setLocalComponents((prev) =>
      prev.map((c) =>
        c.id !== targetComponent.id ? c : { ...c, [field]: value },
      ),
    );
  }

  // ─── Component detail handlers ───

  function toggleComponentDetail(componentId: number) {
    setExpandedComponentIds((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  }

  function updateDetailDoc(componentId: number, field: keyof CourseDocument, value: unknown) {
    setComponentDetailDocs((prev) => {
      const next = new Map(prev);
      const existing = next.get(componentId);
      if (existing) {
        next.set(componentId, { ...existing, [field]: value });
      }
      return next;
    });
  }

  function updateDetailExam(componentId: number, field: keyof Exam, value: unknown) {
    setComponentDetailExams((prev) => {
      const next = new Map(prev);
      const existing = next.get(componentId);
      if (existing) {
        next.set(componentId, { ...existing, [field]: value });
      }
      return next;
    });
  }

  function updateDetailAssignment(componentId: number, field: keyof Assignment, value: unknown) {
    setComponentDetailAssignments((prev) => {
      const next = new Map(prev);
      const existing = next.get(componentId);
      if (existing) {
        next.set(componentId, { ...existing, [field]: value });
      }
      return next;
    });
  }

  async function saveComponentDetail(component: InstructorCourseComponent) {
    if (!component.ref_id || component.ref_id <= 0) return;
    setSuccessMessage("");
    setErrorMessage("");

    try {
      if (component.component_type === "document") {
        const doc = componentDetailDocs.get(component.id);
        if (!doc) return;

        // Upload file if changed
        let fileUrl = doc.file_url;
        const newFile = componentDetailFiles.get(component.id);
        if (newFile) {
          const uploadResult = await uploadNewDocumentFile(newFile, doc.document_type);
          fileUrl = uploadResult.file_url;
        }

        await updateInstructorDocument(component.ref_id, {
          title: doc.title,
          document_type: doc.document_type,
          content: doc.content ?? "",
          file_url: fileUrl,
        });
        setSuccessMessage(`✅ Đã cập nhật tài liệu "${doc.title}".`);
      } else if (component.component_type === "exam") {
        const exam = componentDetailExams.get(component.id);
        if (!exam) return;
        await updateInstructorExam(component.ref_id, {
          title: exam.title,
          description: exam.description,
          duration_minutes: exam.duration_minutes,
          total_questions: exam.total_questions,
          pass_score: exam.pass_score,
          max_score: exam.max_score,
        });
        setSuccessMessage(`✅ Đã cập nhật bài kiểm tra "${exam.title}".`);
      } else if (component.component_type === "assignment") {
        const assign = componentDetailAssignments.get(component.id);
        if (!assign) return;

        let assignFileUrl = assign.assignment_file ?? "";
        const newFile = componentDetailFiles.get(component.id);
        if (newFile) {
          const formData = new FormData();
          formData.append("file", newFile);
          formData.append("document_type", "other");
          const uploadResult = await uploadDocumentFile(newFile, "other");
          assignFileUrl = uploadResult.file_url;
        }

        await updateAssignment(component.ref_id, {
          title: assign.title,
          description: assign.description,
          assignment_type: assign.assignment_type,
          assignment_content: assign.assignment_content,
          assignment_file: assignFileUrl || null,
          pass_score: assign.pass_score,
          max_score: assign.max_score,
        });
        setSuccessMessage(`✅ Đã cập nhật bài tập "${assign.title}".`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể lưu chi tiết thành phần.",
      );
    }
  }

  function addLocalModule() {
    pushUndoSnapshot();
    const tempId = -(Date.now());
    const newModule: InstructorCourseModule = {
      id: tempId,
      course_id: courseId,
      title: `Module mới`,
      module_sequence: localModules.length + 1,
      type: "Học liệu",
      introduction: "",
      total_component: 0,
    };
    setLocalModules((prev) => [...prev, newModule]);
  }

  function addLocalComponent(moduleIndex: number) {
    pushUndoSnapshot();
    const targetModule = localModules[moduleIndex];
    if (!targetModule) return;
    const tempId = -(Date.now());
    const moduleComponents = localComponents.filter(
      (c) => c.module_id === targetModule.id,
    );
    const newComponent: InstructorCourseComponent = {
      id: tempId,
      course_id: courseId,
      module_id: targetModule.id,
      title: "Thành phần mới",
      component_sequence: moduleComponents.length + 1,
      component_type: "document",
      ref_id: null,
      summary: "",
      estimated_minutes: 15,
      is_preview: false,
    };
    setLocalComponents((prev) => [...prev, newComponent]);
    // Update module total_component
    setLocalModules((prev) =>
      prev.map((m) =>
        m.id !== targetModule.id
          ? m
          : { ...m, total_component: moduleComponents.length + 1 },
      ),
    );
  }

  function removeLocalModule(index: number) {
    pushUndoSnapshot();
    if (localModules.length <= 1) return;
    const targetModule = localModules[index];
    if (!targetModule) return;

    // Remove components of this module
    setLocalComponents((prev) =>
      prev.filter((c) => c.module_id !== targetModule.id),
    );
    // Remove the module
    setLocalModules((prev) => prev.filter((_, i) => i !== index));
  }

  function removeLocalComponent(moduleIndex: number, componentIndex: number) {
    pushUndoSnapshot();
    const targetModule = localModules[moduleIndex];
    if (!targetModule) return;
    const moduleComponents = localComponents.filter(
      (c) => c.module_id === targetModule.id,
    );
    const targetComponent = moduleComponents[componentIndex];
    if (!targetComponent) return;

    setLocalComponents((prev) => prev.filter((c) => c.id !== targetComponent.id));
    setLocalModules((prev) =>
      prev.map((m) =>
        m.id !== targetModule.id
          ? m
          : { ...m, total_component: Math.max(0, m.total_component - 1) },
      ),
    );
  }

  async function handleSaveModules() {
    setIsSavingModules(true);
    setErrorMessage("");
    setSuccessMessage("");

    const createdModuleIds: number[] = [];
    const createdResourceIds: { id: number; type: "document" | "exam" | "assignment" }[] = [];
    const createdComponentIds: number[] = [];

    const cleanupCreatedResources = async () => {
      for (const cid of [...createdComponentIds].reverse()) {
        try { await deleteCourseComponentApi(cid); } catch { /* best-effort */ }
      }
      for (const res of [...createdResourceIds].reverse()) {
        try {
          if (res.type === "document") await deleteDocument(res.id);
          else if (res.type === "exam") await deleteExam(res.id);
          else await deleteAssignment(res.id);
        } catch { /* best-effort */ }
      }
      for (const mid of [...createdModuleIds].reverse()) {
        try { await deleteModuleApi(mid); } catch { /* best-effort */ }
      }
    };

    try {
      // Track created IDs mapping
      const tempToRealModuleId = new Map<number, number>();
      const tempToRealComponentId = new Map<number, number>();

      // 1. Delete removed components (present in courseDetail but not in local state)
      const originalComponentIds = new Set(
        courseDetail?.components.map((c) => c.id) ?? [],
      );
      const currentComponentIds = new Set(localComponents.map((c) => c.id));
      for (const origId of originalComponentIds) {
        if (!currentComponentIds.has(origId) && origId > 0) {
          await deleteCourseComponentApi(origId);
        }
      }

      // 2. Delete removed modules (present in courseDetail but not in local state)
      const originalModuleIds = new Set(
        courseDetail?.modules.map((m) => m.id) ?? [],
      );
      const currentModuleIds = new Set(localModules.map((m) => m.id));
      for (const origId of originalModuleIds) {
        if (!currentModuleIds.has(origId) && origId > 0) {
          await deleteModuleApi(origId);
        }
      }

      // 3. Upsert modules (create new, update existing)
      for (let i = 0; i < localModules.length; i++) {
        const m = localModules[i];
        const payload = {
          title: m.title,
          module_sequence: i + 1,
          type: m.type,
          introduction: m.introduction,
          total_component: localComponents.filter((c) => c.module_id === m.id).length,
        };

        if (m.id > 0) {
          // Update existing module
          const updated = await updateModuleApi(m.id, payload);
          tempToRealModuleId.set(m.id, updated.id);
        } else {
          // Create new module
          const created = await createModule({
            course_id: courseId,
            title: m.title,
            module_sequence: i + 1,
            type: m.type,
            introduction: m.introduction,
            total_component: localComponents.filter((c) => c.module_id === m.id).length,
          });
          createdModuleIds.push(created.id);
          tempToRealModuleId.set(m.id, created.id);
        }
      }

      // 4. Upsert components
      for (const c of localComponents) {
        const realModuleId =
          tempToRealModuleId.get(c.module_id) ?? c.module_id;
        const payload: CourseComponentCreatePayload = {
          course_id: courseId,
          module_id: realModuleId,
          title: c.title,
          component_sequence: c.component_sequence,
          component_type: c.component_type,
          ref_id: c.ref_id,
          summary: c.summary,
          estimated_minutes: c.estimated_minutes,
          is_preview: c.is_preview,
        };

        if (c.id > 0) {
          // Update existing component
          await updateCourseComponentApi(c.id, payload);
          tempToRealComponentId.set(c.id, c.id);
        } else {
          // Create new component
          const created = await createCourseComponent(payload);
          const newComponentId = created.id;

          // Tạo tài liệu, bài kiểm tra hoặc bài tập tương ứng
          if (c.component_type === "document") {
            const doc = await createDocument({
              title: c.title,
              document_type: "other",
              content: c.summary || "",
              file_url: "",
              course_id: courseId,
              module_id: realModuleId,
            });
            createdResourceIds.push({ id: doc.id, type: "document" });
            await updateCourseComponentApi(newComponentId, {
              ref_id: doc.id,
            });
          } else if (c.component_type === "exam") {
            const exam = await createExam({
              title: c.title,
              description: c.summary || "",
              course_id: courseId,
              module_id: realModuleId,
              duration_minutes: Math.max(1, c.estimated_minutes || 30),
              total_questions: 10,
              pass_score: 50,
              max_score: 100,
              is_active: true,
            });
            await updateCourseComponentApi(newComponentId, {
              ref_id: exam.id,
            });
            createdResourceIds.push({ id: exam.id, type: "exam" });
          } else if (c.component_type === "assignment") {
            const assign = await createAssignment({
              title: c.title,
              description: c.summary || "",
              course_id: courseId,
              module_id: realModuleId,
              assignment_type: "Bài tập tự luận",
              assignment_content: "",
              is_active: true,
              pass_score: 50,
              max_score: 100,
            });
            await updateCourseComponentApi(newComponentId, {
              ref_id: assign.id,
            });
            createdResourceIds.push({ id: assign.id, type: "assignment" });
          }

          createdComponentIds.push(newComponentId);
          tempToRealComponentId.set(c.id, newComponentId);
        }
      }

      // 5. Remap assessment_matrix & content_structure: local temp IDs → real database IDs
      if (courseExtraData) {
        let matrixChanged = false;
        let structureChanged = false;
        let remappedMatrix = courseExtraData.assessment_matrix;
        let remappedStructure = courseExtraData.content_structure;

        // Remap assessment_matrix: local IDs → real IDs
        if (remappedMatrix && remappedMatrix !== "{}") {
          try {
            const parsed = JSON.parse(remappedMatrix);
            for (const key of Object.keys(parsed)) {
              const ids = parsed[key] as number[];
              const remapped = ids.map(
                (id) => tempToRealComponentId.get(id) ?? id,
              );
              if (remapped.some((n, i) => n !== ids[i])) matrixChanged = true;
              parsed[key] = remapped;
            }
            if (matrixChanged) {
              remappedMatrix = JSON.stringify(parsed);
            }
          } catch {
            // Bỏ qua nếu parse lỗi — giữ nguyên giá trị cũ
          }
        }

        // Remap content_structure
        if (remappedStructure && remappedStructure !== "{}") {
          try {
            const parsed = JSON.parse(remappedStructure);

            // Remap taxonomyTags keys
            if (parsed.taxonomyTags && typeof parsed.taxonomyTags === "object") {
              const newTags: Record<string, unknown> = {};
              for (const key of Object.keys(parsed.taxonomyTags)) {
                let newKey = key;
                if (key.startsWith("component:")) {
                  const localId = Number(key.slice("component:".length));
                  const realId = tempToRealComponentId.get(localId);
                  if (realId && realId !== localId) {
                    newKey = `component:${realId}`;
                    structureChanged = true;
                  }
                } else if (key.startsWith("module:")) {
                  const localId = Number(key.slice("module:".length));
                  const realId = tempToRealModuleId.get(localId);
                  if (realId && realId !== localId) {
                    newKey = `module:${realId}`;
                    structureChanged = true;
                  }
                }
                newTags[newKey] = parsed.taxonomyTags[key];
              }
              parsed.taxonomyTags = newTags;
            }

            // Remap prerequisites: local component IDs → real IDs
            if (
              parsed.prerequisites &&
              typeof parsed.prerequisites === "object"
            ) {
              const newPrereqs: Record<string, number | null> = {};
              for (const key of Object.keys(parsed.prerequisites)) {
                const localCompId = Number(key);
                const realCompId =
                  tempToRealComponentId.get(localCompId) ?? localCompId;
                const localPrereqId: number | null =
                  parsed.prerequisites[key];
                const realPrereqId = localPrereqId
                  ? tempToRealComponentId.get(localPrereqId) ?? localPrereqId
                  : null;

                if (
                  realCompId !== localCompId ||
                  realPrereqId !== localPrereqId
                ) {
                  structureChanged = true;
                }
                newPrereqs[String(realCompId)] = realPrereqId;
              }
              parsed.prerequisites = newPrereqs;
            }

            if (structureChanged) {
              remappedStructure = JSON.stringify(parsed);
            }
          } catch {
            // Bỏ qua nếu parse lỗi — giữ nguyên giá trị cũ
          }
        }

        // Persist remapped data if changed
        if (matrixChanged || structureChanged) {
          await updateCourseExtraData(courseId, {
            assessment_matrix: matrixChanged
              ? remappedMatrix
              : courseExtraData.assessment_matrix,
            content_structure: structureChanged
              ? remappedStructure
              : courseExtraData.content_structure,
          });

          // Update local state
          setCourseExtraData((prev) =>
            prev
              ? {
                  ...prev,
                  assessment_matrix: matrixChanged
                    ? remappedMatrix
                    : prev.assessment_matrix,
                  content_structure: structureChanged
                    ? remappedStructure
                    : prev.content_structure,
                }
              : prev,
          );
        }
      }

      // 6. Reload course detail to get fresh data
      const freshDetail = await getInstructorCourseDetail(courseId);
      setCourseDetail(freshDetail);

      setSuccessMessage("✅ Module và thành phần đã được lưu.");
    } catch (error) {
      await cleanupCreatedResources();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu module và thành phần.",
      );
    } finally {
      setIsSavingModules(false);
    }
  }

  async function handleSaveExtraData() {
    if (!courseExtraData) return;
    setIsSavingExtraData(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Cycle detection for prerequisite
      const newRequiredId = courseExtraData.required_course_id;
      if (newRequiredId && newRequiredId > 0) {
        let current: number | null = newRequiredId;
        const visited = new Set<number>();
        while (current !== null && current > 0) {
          if (current === courseId) {
            throw new Error("Không thể chọn khóa học yêu cầu trước tạo thành vòng lặp (A→B→A).");
          }
          if (visited.has(current)) {
            throw new Error("Phát hiện vòng lặp trong chuỗi khóa học yêu cầu trước.");
          }
          visited.add(current);
          current = requiredCourseMap.get(current) ?? null;
        }
      }

      await updateCourseExtraData(courseId, {
        objective: courseExtraData.objective,
        requirement: courseExtraData.requirement,
        required_course_id: courseExtraData.required_course_id,
        open_at: courseExtraData.open_at,
        close_at: courseExtraData.close_at,
        bloom_objectives: courseExtraData.bloom_objectives,
        assessment_matrix: courseExtraData.assessment_matrix,
        content_structure: courseExtraData.content_structure,
      });
      setSuccessMessage("✅ Thông tin mở rộng đã được lưu.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể lưu thông tin mở rộng.");
    } finally {
      setIsSavingExtraData(false);
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
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => router.push(`/instructor/courses/${courseId}`)}
            aria-label="Quay lại chi tiết khóa học"
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
            <h1 className="text-lg font-semibold">Chỉnh sửa khóa học</h1>
            <p className="text-sm text-slate-500">
              Cập nhật thông tin cơ bản, mục tiêu và cấu trúc nội dung
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && courseDetail && form ? (
          <>
            {/* ─── Thông tin cơ bản ─── */}
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Thông tin cơ bản</h2>
                  <p className="text-sm text-slate-500">
                    Tên khóa học, mô tả, phân loại và trình độ
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Tên khóa học</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    placeholder="Nhập tên khóa học"
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Giới thiệu ngắn</span>
                  <input
                    type="text"
                    value={form.introduction}
                    onChange={(e) => updateForm("introduction", e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    placeholder="Giới thiệu ngắn về khóa học"
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Mô tả chi tiết</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    placeholder="Mô tả chi tiết nội dung khóa học"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Phân loại</span>
                    <select
                      value={form.category_id}
                      onChange={(e) => updateForm("category_id", Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Trình độ</span>
                    <select
                      value={form.level}
                      onChange={(e) => updateForm("level", e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    >
                      <option value="Cơ bản">Cơ bản</option>
                      <option value="Trung bình">Trung bình</option>
                      <option value="Nâng cao">Nâng cao</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Số sinh viên dự kiến</span>
                  <input
                    type="number"
                    value={form.total_student}
                    onChange={(e) => updateForm("total_student", Number(e.target.value))}
                    min={0}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                </label>

                {/* Image upload */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="relative mb-3 h-48 w-full overflow-hidden rounded-xl bg-slate-200">
                    <Image
                      src={previewImageUrl || "/logo.png"}
                      alt="Hình đại diện"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <label className="block">
                    <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <FileImage className="h-4 w-4" />
                      Thay đổi hình đại diện
                    </span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={(e) => setSelectedImageFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>
                  {selectedImageFile && (
                    <p className="mt-2 text-sm text-sky-700">Đã chọn: {selectedImageFile.name}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveBasicInfo}
                  disabled={isSaving}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
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
                  <span>{isSaving ? "Đang lưu..." : "Lưu thông tin cơ bản"}</span>
                </button>
              </div>
            </article>

            {/* ─── Module và thành phần ─── */}
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <BookOpen className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Module và thành phần</h2>
                  <p className="text-sm text-slate-500">
                    Thêm, sửa, xóa module và thành phần khóa học
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {localModules.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/60 px-5 py-10 text-center">
                    <BookOpen className="mx-auto h-9 w-9 text-violet-400" />
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                      Chưa có module nào
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Hãy thêm module đầu tiên để bắt đầu xây dựng cấu trúc khóa học.
                    </p>
                  </div>
                ) : localModules.map((module, moduleIndex) => (
                  <div
                    key={module.id}
                    draggable
                    onDragStart={() => handleModuleDragStart(moduleIndex)}
                    onDragOver={(e) => handleModuleDragOver(e, moduleIndex)}
                    onDragEnd={handleModuleDragEnd}
                    className={`rounded-3xl border border-slate-200 bg-slate-50 p-5 transition-all ${getModuleDragStyle(moduleIndex)}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                          title="Kéo để sắp xếp"
                        >
                          <GripVertical className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm text-slate-500">
                            Module {moduleIndex + 1}
                          </p>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {module.title}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addLocalComponent(moduleIndex)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-200"
                        >
                          <Plus className="h-4 w-4" />
                          Thêm thành phần
                        </button>
                        {localModules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLocalModule(moduleIndex)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="space-y-1.5 text-sm text-slate-700">
                        <span>Tiêu đề module</span>
                        <input
                          type="text"
                          value={module.title}
                          onChange={(e) =>
                            updateLocalModule(moduleIndex, "title", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                        />
                      </label>
                      <label className="space-y-1.5 text-sm text-slate-700">
                        <span>Giới thiệu module</span>
                        <input
                          type="text"
                          value={module.introduction}
                          onChange={(e) =>
                            updateLocalModule(moduleIndex, "introduction", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                        />
                      </label>
                    </div>

                    {/* Components list */}
                    <div className="mt-4 space-y-3">
                      {localComponents
                        .filter((c) => c.module_id === module.id)
                        .sort((a, b) => a.component_sequence - b.component_sequence)
                        .map((component, compIndex) => (
                          <div
                            key={component.id}
                            draggable
                            onDragStart={() =>
                              handleCompDragStart(module.id, component.id)
                            }
                            onDragOver={(e) =>
                              handleCompDragOver(e, module.id, component.id)
                            }
                            onDragEnd={handleCompDragEnd}
                            className={`rounded-2xl border border-slate-200 bg-white p-4 transition-all ${getCompDragStyle(
                              module.id,
                              component.id,
                            )}`}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                                  title="Kéo để sắp xếp"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="text-xs text-slate-500">
                                    {getComponentTypeLabel(component.component_type)} — Thành phần{" "}
                                    {compIndex + 1}
                                  </p>
                                  <h4 className="text-base font-semibold text-slate-900">
                                    {component.title}
                                  </h4>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleComponentDetail(component.id)}
                                className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors ${
                                  expandedComponentIds.has(component.id)
                                    ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {expandedComponentIds.has(component.id) ? "Thu gọn" : "Chi tiết"}
                              </button>
                                {localComponents.filter((c) => c.module_id === module.id).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeLocalComponent(moduleIndex, compIndex)
                                    }
                                    className="inline-flex items-center gap-2 rounded-2xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1.5 text-sm text-slate-700">
                                <span>Tên thành phần</span>
                                <input
                                  type="text"
                                  value={component.title}
                                  onChange={(e) =>
                                    updateLocalComponent(
                                      moduleIndex,
                                      compIndex,
                                      "title",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
                                />
                              </label>
                              <label className="space-y-1.5 text-sm text-slate-700">
                                <span>Loại thành phần</span>
                                <select
                                  value={component.component_type}
                                  onChange={(e) =>
                                    updateLocalComponent(
                                      moduleIndex,
                                      compIndex,
                                      "component_type",
                                      e.target.value as "document" | "exam" | "assignment",
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
                                >
                                  <option value="document">Tài liệu</option>
                                  <option value="exam">Bài kiểm tra</option>
                                  <option value="assignment">Bài tập</option>
                                </select>
                              </label>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1.5 text-sm text-slate-700">
                                <span>Tóm tắt / mô tả</span>
                                <input
                                  type="text"
                                  value={component.summary}
                                  onChange={(e) =>
                                    updateLocalComponent(
                                      moduleIndex,
                                      compIndex,
                                      "summary",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
                                />
                              </label>
                              <label className="space-y-1.5 text-sm text-slate-700">
                                <span>Thời lượng (phút)</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={component.estimated_minutes}
                                  onChange={(e) =>
                                    updateLocalComponent(
                                      moduleIndex,
                                      compIndex,
                                      "estimated_minutes",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400"
                                />
                              </label>
                            </div>

                            <label className="mt-3 inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={component.is_preview}
                                onChange={(e) =>
                                  updateLocalComponent(
                                    moduleIndex,
                                    compIndex,
                                    "is_preview",
                                    e.target.checked,
                                  )
                                }
                              />
                              Cho phép xem thử
                            </label>

                            {/* Expandable detail editing */}
                            {expandedComponentIds.has(component.id) && (
                              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <h5 className="text-sm font-semibold text-violet-800">
                                    Chi tiết {getComponentTypeLabel(component.component_type)}
                                  </h5>
                                  {component.ref_id && component.ref_id > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => saveComponentDetail(component)}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                      Lưu
                                    </button>
                                  )}
                                </div>

                                {component.component_type === "document" &&
                                  (() => {
                                    const doc = componentDetailDocs.get(component.id);
                                    if (!doc && (!component.ref_id || component.ref_id <= 0)) {
                                      return (
                                        <p className="text-xs text-slate-500 italic">
                                          Lưu module trước để tạo tài liệu, sau đó chỉnh sửa chi tiết.
                                        </p>
                                      );
                                    }
                                    if (!doc) {
                                      return (
                                        <p className="text-xs text-slate-500 italic">
                                          Đang tải thông tin tài liệu...
                                        </p>
                                      );
                                    }
                                    return (
                                      <div className="space-y-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Loại tài liệu</span>
                                            <select
                                              value={doc.document_type}
                                              onChange={(e) =>
                                                updateDetailDoc(
                                                  component.id,
                                                  "document_type",
                                                  e.target.value as DocumentType,
                                                )
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            >
                                              <option value="pdf">PDF</option>
                                              <option value="video">Video</option>
                                              <option value="other">Khác</option>
                                            </select>
                                          </label>
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Nội dung mô tả</span>
                                            <textarea
                                              rows={2}
                                              value={doc.content ?? ""}
                                              onChange={(e) =>
                                                updateDetailDoc(component.id, "content", e.target.value)
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            />
                                          </label>
                                        </div>

                                        {doc.document_type === "video" ? (
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Liên kết video (YouTube/Vimeo)</span>
                                            <div className="flex gap-2">
                                              <input
                                                type="url"
                                                value={
                                                  isEmbeddableVideoUrl(doc.file_url)
                                                    ? doc.file_url
                                                    : ""
                                                }
                                                onChange={(e) => {
                                                  const url = e.target.value;
                                                  updateDetailDoc(component.id, "file_url", url);
                                                }}
                                                placeholder="https://youtube.com/watch?v=..."
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                              />
                                            </div>
                                          </label>
                                        ) : (
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>
                                              {doc.document_type === "pdf"
                                                ? "Tải tệp PDF"
                                                : "Tải tệp lên"}
                                            </span>
                                            <input
                                              type="file"
                                              accept={
                                                doc.document_type === "pdf" ? ".pdf" : "*/*"
                                              }
                                              onChange={(e) => {
                                                const file = e.target.files?.[0] ?? null;
                                                setComponentDetailFiles((prev) => {
                                                  const next = new Map(prev);
                                                  next.set(component.id, file);
                                                  return next;
                                                });
                                              }}
                                              className="w-full text-sm text-slate-700"
                                            />
                                            {componentDetailFiles.get(component.id) && (
                                              <p className="mt-1 text-xs text-violet-600">
                                                Đã chọn: {componentDetailFiles.get(component.id)?.name}
                                              </p>
                                            )}
                                            {doc.file_url && !componentDetailFiles.get(component.id) && (
                                              <p className="mt-1 text-xs text-slate-400">
                                                Tệp hiện tại: {doc.file_url.split("/").pop()}
                                              </p>
                                            )}
                                          </label>
                                        )}
                                      </div>
                                    );
                                  })()}

                                {component.component_type === "exam" &&
                                  (() => {
                                    const exam = componentDetailExams.get(component.id);
                                    if (!exam && (!component.ref_id || component.ref_id <= 0)) {
                                      return (
                                        <p className="text-xs text-slate-500 italic">
                                          Lưu module trước để tạo bài kiểm tra, sau đó chỉnh sửa chi tiết.
                                        </p>
                                      );
                                    }
                                    if (!exam) {
                                      return (
                                        <p className="text-xs text-slate-500 italic">
                                          Đang tải thông tin bài kiểm tra...
                                        </p>
                                      );
                                    }
                                    return (
                                      <div className="space-y-3">
                                        <label className="space-y-1 text-sm text-slate-700">
                                          <span>Mô tả đề thi</span>
                                          <textarea
                                            rows={2}
                                            value={exam.description ?? ""}
                                            onChange={(e) =>
                                              updateDetailExam(component.id, "description", e.target.value)
                                            }
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                          />
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-4">
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Thời lượng (phút)</span>
                                            <input
                                              type="number"
                                              min={1}
                                              value={exam.duration_minutes}
                                              onChange={(e) =>
                                                updateDetailExam(
                                                  component.id,
                                                  "duration_minutes",
                                                  Number(e.target.value),
                                                )
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            />
                                          </label>
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Số câu hỏi</span>
                                            <input
                                              type="number"
                                              min={1}
                                              value={exam.total_questions}
                                              onChange={(e) =>
                                                updateDetailExam(
                                                  component.id,
                                                  "total_questions",
                                                  Number(e.target.value),
                                                )
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            />
                                          </label>
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Điểm đạt</span>
                                            <input
                                              type="number"
                                              min={0}
                                              max={exam.max_score}
                                              value={exam.pass_score}
                                              onChange={(e) =>
                                                updateDetailExam(
                                                  component.id,
                                                  "pass_score",
                                                  Number(e.target.value),
                                                )
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            />
                                          </label>
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Điểm tối đa</span>
                                            <input
                                              type="number"
                                              min={1}
                                              value={exam.max_score}
                                              onChange={(e) =>
                                                updateDetailExam(
                                                  component.id,
                                                  "max_score",
                                                  Number(e.target.value),
                                                )
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                {component.component_type === "assignment" &&
                                  (() => {
                                    const assign = componentDetailAssignments.get(component.id);
                                    if (!assign && (!component.ref_id || component.ref_id <= 0)) {
                                      return (
                                        <p className="text-xs text-slate-500 italic">
                                          Lưu module trước để tạo bài tập, sau đó chỉnh sửa chi tiết.
                                        </p>
                                      );
                                    }
                                    if (!assign) {
                                      return (
                                        <p className="text-xs text-slate-500 italic">
                                          Đang tải thông tin bài tập...
                                        </p>
                                      );
                                    }
                                    return (
                                      <div className="space-y-3">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <label className="space-y-1 text-sm text-slate-700">
                                            <span>Loại bài tập</span>
                                            <select
                                              value={assign.assignment_type}
                                              onChange={(e) =>
                                                updateDetailAssignment(
                                                  component.id,
                                                  "assignment_type",
                                                  e.target.value,
                                                )
                                              }
                                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                            >
                                              <option value="Bài tập tự luận">Bài tập tự luận</option>
                                              <option value="Bài tập nộp tệp">Bài tập nộp tệp</option>
                                              <option value="Bài tập lập trình">Bài tập lập trình</option>
                                            </select>
                                          </label>
                                          <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="space-y-1 text-sm text-slate-700">
                                              <span>Điểm đạt</span>
                                              <input
                                                type="number"
                                                min={0}
                                                max={assign.max_score}
                                                value={assign.pass_score}
                                                onChange={(e) =>
                                                  updateDetailAssignment(
                                                    component.id,
                                                    "pass_score",
                                                    Number(e.target.value),
                                                  )
                                                }
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                              />
                                            </label>
                                            <label className="space-y-1 text-sm text-slate-700">
                                              <span>Điểm tối đa</span>
                                              <input
                                                type="number"
                                                min={1}
                                                value={assign.max_score}
                                                onChange={(e) =>
                                                  updateDetailAssignment(
                                                    component.id,
                                                    "max_score",
                                                    Number(e.target.value),
                                                  )
                                                }
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                              />
                                            </label>
                                          </div>
                                        </div>

                                        <label className="space-y-1 text-sm text-slate-700">
                                          <span>Nội dung bài tập</span>
                                          <textarea
                                            rows={4}
                                            value={assign.assignment_content ?? ""}
                                            onChange={(e) =>
                                              updateDetailAssignment(
                                                component.id,
                                                "assignment_content",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Mô tả yêu cầu bài tập, hướng dẫn làm bài..."
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                                          />
                                        </label>

                                        <label className="space-y-1 text-sm text-slate-700">
                                          <span>Tải tệp đính kèm (tùy chọn)</span>
                                          <input
                                            type="file"
                                            accept=".pdf,.docx,.zip,.rar,.txt"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0] ?? null;
                                              setComponentDetailFiles((prev) => {
                                                const next = new Map(prev);
                                                next.set(component.id, file);
                                                return next;
                                              });
                                            }}
                                            className="w-full text-sm text-slate-700"
                                          />
                                          {componentDetailFiles.get(component.id) && (
                                            <p className="mt-1 text-xs text-violet-600">
                                              Đã chọn: {componentDetailFiles.get(component.id)?.name}
                                            </p>
                                          )}
                                        </label>
                                      </div>
                                    );
                                  })()}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    title="Hoàn tác (Ctrl+Z)"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      undoStack.length === 0
                        ? "cursor-not-allowed text-slate-300"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    ↩ Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    title="Làm lại (Ctrl+Shift+Z)"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      redoStack.length === 0
                        ? "cursor-not-allowed text-slate-300"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    ↪ Làm lại
                  </button>

                  <div className="mx-1 h-6 w-px bg-slate-200" />

                  <button
                    type="button"
                    onClick={addLocalModule}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm module mới
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveModules}
                    disabled={isSavingModules}
                    className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-colors ${
                      isSavingModules
                        ? "cursor-not-allowed bg-slate-400"
                        : "bg-slate-900 hover:bg-slate-700"
                    }`}
                  >
                    {isSavingModules ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSavingModules
                      ? "Đang lưu..."
                      : "Lưu module và thành phần"}
                  </button>
                </div>
              </div>
            </article>

            {/* ─── Thông tin mở rộng ─── */}
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Thông tin mở rộng</h2>
                  <p className="text-sm text-slate-500">
                    Mục tiêu Bloom, ma trận đánh giá, cấu trúc nội dung và yêu cầu
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Bloom Objectives */}
                <div className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Mục tiêu khóa học (theo thang Bloom)</span>
                  <BloomObjectives
                    value={courseExtraData?.bloom_objectives ?? "{}"}
                    onChange={(json) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? { ...prev, bloom_objectives: json }
                          : null, // shouldn't happen as we create on save
                      )
                    }
                  />
                </div>

                {/* Bloom Gap Alert */}
                <BloomGapAlert
                  bloomObjectivesJson={courseExtraData?.bloom_objectives ?? "{}"}
                  assessmentMatrixJson={courseExtraData?.assessment_matrix ?? "{}"}
                  hasAssessmentComponents={components.some(
                    (c) => c.component_type === "exam" || c.component_type === "assignment",
                  )}
                />

                {/* Assessment Matrix */}
                <div className="space-y-2 text-sm text-slate-700">
                  <AssessmentMatrix
                    value={courseExtraData?.assessment_matrix ?? "{}"}
                    components={components as InstructorCourseComponent[]}
                    onChange={(json) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? {
                              ...prev,
                              assessment_matrix: json,
                              content_structure: mergeMatrixIntoStructure(
                                json,
                                prev.content_structure,
                                components as InstructorCourseComponent[],
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                </div>

                {/* Content Structure */}
                <div className="space-y-2 text-sm text-slate-700">
                  <ContentStructure
                    value={courseExtraData?.content_structure ?? "{}"}
                    modules={modules}
                    components={components as InstructorCourseComponent[]}
                    onChange={(json) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? {
                              ...prev,
                              content_structure: json,
                              assessment_matrix: mergeStructureIntoMatrix(
                                json,
                                prev.assessment_matrix,
                                components as InstructorCourseComponent[],
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                </div>

                {/* Requirement */}
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Yêu cầu khóa học</span>
                  <textarea
                    value={courseExtraData?.requirement ?? ""}
                    onChange={(e) =>
                      setCourseExtraData((prev) =>
                        prev ? { ...prev, requirement: e.target.value } : prev,
                      )
                    }
                    rows={3}
                    placeholder="Nhập yêu cầu của khóa học..."
                    className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                </label>

                {/* Open/Close dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4 text-sky-600" />
                      Ngày mở khóa học
                    </span>
                    <input
                      type="datetime-local"
                      value={
                        courseExtraData?.open_at
                          ? new Date(courseExtraData.open_at).toISOString().slice(0, 16)
                          : new Date().toISOString().slice(0, 16)
                      }
                      onChange={(e) =>
                        setCourseExtraData((prev) =>
                          prev
                            ? { ...prev, open_at: new Date(e.target.value).toISOString() }
                            : prev,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      Ngày kết thúc
                    </span>
                    <input
                      type="datetime-local"
                      value={
                        courseExtraData?.close_at
                          ? new Date(courseExtraData.close_at).toISOString().slice(0, 16)
                          : new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 16)
                      }
                      onChange={(e) =>
                        setCourseExtraData((prev) =>
                          prev
                            ? { ...prev, close_at: new Date(e.target.value).toISOString() }
                            : prev,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    />
                  </label>
                </div>

                {/* Prerequisite course */}
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Khóa học yêu cầu trước (tùy chọn)</span>
                  <select
                    value={courseExtraData?.required_course_id ?? 0}
                    onChange={(e) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? {
                              ...prev,
                              required_course_id:
                                Number(e.target.value) > 0 ? Number(e.target.value) : null,
                            }
                          : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    <option value={0}>Không có</option>
                    {prerequisiteCourses
                      .filter((pc) => pc.id !== courseId)
                      .map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.title}
                        </option>
                      ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    // Create extra data if not exists
                    if (!courseExtraData) {
                      try {
                        const created = await createCourseExtraData({
                          course_id: courseId,
                          objective: "",
                          requirement: "",
                          required_course_id: null,
                          open_at: new Date().toISOString(),
                          close_at: new Date(Date.now() + 365 * 86400000).toISOString(),
                        });
                        setCourseExtraData(created);
                        setSuccessMessage("✅ Đã tạo thông tin mở rộng. Hãy điền nội dung và lưu lại.");
                      } catch (err) {
                        setErrorMessage(
                          err instanceof Error ? err.message : "Không thể tạo thông tin mở rộng.",
                        );
                      }
                      return;
                    }
                    await handleSaveExtraData();
                  }}
                  disabled={isSavingExtraData}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
                    isSavingExtraData
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isSavingExtraData ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {isSavingExtraData
                      ? "Đang lưu..."
                      : courseExtraData
                        ? "Lưu thông tin mở rộng"
                        : "Tạo thông tin mở rộng"}
                  </span>
                </button>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}
