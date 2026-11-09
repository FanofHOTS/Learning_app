"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Baseline,
  Bold,
  ChevronDown,
  Code,
  Download,
  Eraser,
  FileText,
  Highlighter,
  Italic,
  Link2,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  LoaderCircle,
  Menu,
  Minus,
  Quote,
  Redo2,
  Save,
  Share,
  Sparkles,
  SquareCode,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline,
  Undo2,
  Unlink2,
  Upload,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import type { JSONContent } from "@tiptap/core";
import { toast } from "react-toastify";
import { NotificationBell } from "../../../components/notification-bell";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import {
  createLessonDraft,
  getLessonDraft,
  getLessonDraftList,
  LessonDraftApiError,
  type LessonDraft,
  type LessonDraftSummary,
  updateLessonDraft,
} from "../../../lib/api_lesson_draft";
import {
  createLessonDocx,
  createLessonPdfFile,
  createLessonTextFile,
  downloadLessonFile,
} from "../../../lib/lesson_document_export";
import {
  generateLessonText,
  type LessonWritingAction,
} from "../../../lib/api_lesson_writer";
import {
  deleteOldUploadedFile,
  getInstructorDocumentList,
  updateInstructorDocument,
  uploadNewDocumentFile,
  type InstructorDocument,
} from "../../../lib/api_document_instructor";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import styles from "./page.module.css";

const isMockDataMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const FONT_SIZE_OPTIONS = [
  "12pt",
  "14pt",
  "16pt",
  "18pt",
  "20pt",
  "24pt",
  "28pt",
  "32pt",
];

const toolbarSelectClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-40";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

type LocalDraft = {
  title: string;
  content: string | JSONContent;
};

type InitialDraftState = {
  drafts: LessonDraftSummary[];
  activeDraft: LessonDraft | null;
  localDraft: LocalDraft | null;
  localDraftError: string | null;
};

function isTiptapDocument(value: unknown): value is JSONContent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "doc"
  );
}

function readLocalDraft(key: string): LocalDraft | null {
  const rawDraft = window.localStorage.getItem(key);
  if (!rawDraft) {
    return null;
  }

  const parsedDraft: unknown = JSON.parse(rawDraft);
  if (
    typeof parsedDraft !== "object" ||
    parsedDraft === null ||
    !("title" in parsedDraft) ||
    typeof parsedDraft.title !== "string" ||
    !("content" in parsedDraft) ||
    (typeof parsedDraft.content !== "string" &&
      !isTiptapDocument(parsedDraft.content))
  ) {
    throw new Error("Bản nháp trên thiết bị không đúng định dạng.");
  }

  return { title: parsedDraft.title, content: parsedDraft.content };
}

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${
        active
          ? "bg-sky-100 text-sky-800"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function isSupportedLessonSource(document: InstructorDocument): boolean {
  const filePath = document.file_url.split(/[?#]/, 1)[0].toLowerCase();
  const hasSupportedFile = [
    ".pdf",
    ".docx",
    ".pptx",
    ".txt",
    ".md",
    ".markdown",
  ].some((extension) => filePath.endsWith(extension));
  return hasSupportedFile || (!document.file_url && Boolean(document.content?.trim()));
}

function plainTextToTiptapContent(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let paragraphLines: string[] = [];
  let listType: "bulletList" | "orderedList" | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const paragraph = paragraphLines.join(" ").trim();
    if (paragraph) {
      nodes.push({
        type: "paragraph",
        content: [{ type: "text", text: paragraph }],
      });
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) {
      listType = null;
      listItems = [];
      return;
    }
    nodes.push({
      type: listType,
      content: listItems.map((item) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: item }],
          },
        ],
      })),
    });
    listType = null;
    listItems = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      nodes.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2] }],
      });
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(line);
    const nextListType = bullet
      ? "bulletList"
      : ordered
        ? "orderedList"
        : null;
    if (nextListType) {
      flushParagraph();
      if (listType !== nextListType) {
        flushList();
        listType = nextListType;
      }
      listItems.push((bullet ?? ordered)?.[1] ?? line);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return nodes.length ? nodes : [{ type: "paragraph" }];
}

export default function InstructorDocumentEditorPage() {
  const router = useRouter();
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [title, setTitle] = useState("Bài giảng chưa có tiêu đề");
  const [drafts, setDrafts] = useState<LessonDraftSummary[]>([]);
  const [documents, setDocuments] = useState<InstructorDocument[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [replacementFormat, setReplacementFormat] = useState<"docx" | "txt">("docx");
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReplacingDocument, setIsReplacingDocument] = useState(false);
  const [documentListError, setDocumentListError] = useState("");
  const [isSyncAvailable, setIsSyncAvailable] = useState(!isMockDataMode);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Đang chuẩn bị bản nháp...");
  const [saveError, setSaveError] = useState("");
  const [hasSaveConflict, setHasSaveConflict] = useState(false);
  const [writerAction, setWriterAction] = useState<LessonWritingAction | null>(
    null,
  );
  const [isWriterMenuOpen, setIsWriterMenuOpen] = useState(false);
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [writerDocumentId, setWriterDocumentId] = useState<number | null>(null);
  const [writerFile, setWriterFile] = useState<File | null>(null);
  const [writerOutline, setWriterOutline] = useState("");
  const [writerInstructions, setWriterInstructions] = useState("");
  const [writerPreview, setWriterPreview] = useState("");
  const [writerError, setWriterError] = useState("");
  const [isGeneratingWriterText, setIsGeneratingWriterText] = useState(false);
  const writerSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const activeDraftIdRef = useRef<number | null>(null);
  const draftVersionsRef = useRef(new Map<number, number>());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimerRef = useRef<number | null>(null);
  const initializationRef = useRef<{
    userId: number;
    promise: Promise<InitialDraftState>;
  } | null>(null);
  const loadRequestRef = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: emptyDocument,
    editable: false,
    immediatelyRender: false,
    onUpdate: () => setEditorRevision((revision) => revision + 1),
    onSelectionUpdate: () => setEditorRevision((revision) => revision + 1),
  });

  const user = currentUser ?? initialUser;

  const textStyleAttributes = editor?.getAttributes("textStyle") ?? {};
  const activeTextColor =
    typeof textStyleAttributes.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(textStyleAttributes.color)
      ? textStyleAttributes.color
      : "#0f172a";
  const activeFontSize =
    typeof textStyleAttributes.fontSize === "string" &&
    FONT_SIZE_OPTIONS.includes(textStyleAttributes.fontSize)
      ? textStyleAttributes.fontSize
      : "";
  const paragraphStyle = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : editor?.isActive("heading", { level: 3 })
        ? "h3"
        : "paragraph";
  const editorText = isDraftLoaded && editor ? editor.getText() : "";
  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;

  function openLinkMenu() {
    if (!editor) {
      return;
    }
    const href = editor.getAttributes("link").href;
    setLinkUrl(typeof href === "string" ? href : "");
    setIsLinkMenuOpen(true);
  }

  function applyLink() {
    if (!editor) {
      return;
    }
    const rawUrl = linkUrl.trim();
    if (!rawUrl) {
      toast.warning("Hãy nhập địa chỉ liên kết.");
      return;
    }
    const href = /^(https?:\/\/|mailto:|tel:)/i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href, target: "_blank", rel: "noopener noreferrer" })
      .run();
    setIsLinkMenuOpen(false);
    setLinkUrl("");
    toast.success("Đã thêm liên kết.");
  }

  function removeLink() {
    if (!editor) {
      return;
    }
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkMenuOpen(false);
    setLinkUrl("");
  }

  function applyAlignment(alignment: "left" | "center" | "right" | "justify") {
    if (!editor) {
      return;
    }
    if (editor.isActive({ textAlign: alignment })) {
      editor.chain().focus().unsetTextAlign().run();
      return;
    }
    editor.chain().focus().setTextAlign(alignment).run();
  }

  function openWritingAssistant(action: LessonWritingAction) {
    if (!editor || !isDraftLoaded) {
      return;
    }
    if (isMockDataMode) {
      toast.info("Hãy tắt chế độ dữ liệu mô phỏng để sử dụng trợ lý AI.");
      return;
    }
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, "\n\n").trim();
    if (action === "rewrite_selection" && !selectedText) {
      toast.warning("Hãy chọn đoạn văn bản cần soạn lại trước.");
      return;
    }
    if (action === "rewrite_selection" && selectedText.length > 6_000) {
      toast.warning("Hãy chọn đoạn ngắn hơn (tối đa 6.000 ký tự).");
      return;
    }

    writerSelectionRef.current = { from, to };
    setWriterAction(action);
    setWriterOutline("");
    setWriterInstructions("");
    setWriterPreview("");
    setWriterError("");
    setWriterDocumentId(null);
    setWriterFile(null);
    setIsWriterMenuOpen(false);
    editor.setEditable(false);
  }

  function closeWritingAssistant() {
    if (isGeneratingWriterText) {
      return;
    }
    setWriterAction(null);
    setWriterPreview("");
    setWriterError("");
    editor?.setEditable(isDraftLoaded);
  }

  async function generateWritingPreview() {
    if (!editor || !writerAction || isGeneratingWriterText) {
      return;
    }
    if (title.length > 200) {
      setWriterError("Tiêu đề bài giảng không được vượt quá 200 ký tự.");
      return;
    }
    if (
      writerAction === "generate_from_document" &&
      writerDocumentId === null &&
      writerFile === null
    ) {
      setWriterError("Hãy chọn tài liệu có sẵn hoặc tải lên một tệp.");
      return;
    }
    setIsGeneratingWriterText(true);
    setWriterError("");
    setWriterPreview("");

    try {
      const { from, to } = writerSelectionRef.current ?? {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
      const selectedText = editor.state.doc.textBetween(from, to, "\n\n").trim();
      const context =
        writerAction === "rewrite_selection" ||
        writerAction === "generate_from_document"
          ? ""
          : editor.getText({ blockSeparator: "\n\n" }).slice(0, 10_000);
      const result = await generateLessonText({
        action: writerAction,
        title,
        outline:
          writerAction === "continue_from_outline" ? writerOutline : undefined,
        selected_text:
          writerAction === "rewrite_selection" ? selectedText : undefined,
        document_id:
          writerAction === "generate_from_document" && !writerFile
            ? (writerDocumentId ?? undefined)
            : undefined,
        context,
        instructions: writerInstructions,
      }, writerFile ?? undefined);
      setWriterPreview(result.generated_text);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể tạo nội dung bài giảng bằng AI.";
      setWriterError(message);
      toast.error(message);
    } finally {
      setIsGeneratingWriterText(false);
    }
  }

  function applyWritingPreview() {
    if (!editor || !writerAction || !writerPreview.trim()) {
      return;
    }
    const selection = writerSelectionRef.current;
    if (!selection) {
      toast.error("Không xác định được vị trí chèn nội dung. Hãy thử lại.");
      closeWritingAssistant();
      return;
    }

    const content = plainTextToTiptapContent(writerPreview);
    const range =
      writerAction === "rewrite_selection"
        ? selection
        : { from: selection.from, to: selection.from };
    editor.commands.insertContentAt(range, content);
    setWriterAction(null);
    setWriterPreview("");
    setWriterError("");
    editor.setEditable(isDraftLoaded);
    editor.commands.focus();
    toast.success(
      writerAction === "rewrite_selection"
        ? "Đã thay đoạn văn bản bằng nội dung AI."
        : "Đã chèn nội dung AI vào bài giảng.",
    );
  }

  useEffect(() => {
    editor?.setEditable(isDraftLoaded);
  }, [editor, isDraftLoaded]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;
    void getInstructorDocumentList(currentUser.id)
      .then((documentList) => {
        if (!isMounted) {
          return;
        }
        const eligibleDocuments = documentList.filter(
          (document) =>
            document.document_type === "pdf" ||
            document.document_type === "other",
        );
        setDocuments(eligibleDocuments);
        const requestedDocumentId = Number(
          new URLSearchParams(window.location.search).get("document_id") ?? "",
        );
        if (
          requestedDocumentId &&
          eligibleDocuments.some((document) => document.id === requestedDocumentId)
        ) {
          setSelectedDocumentId(requestedDocumentId);
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        setDocumentListError(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách tài liệu.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const applyServerDraft = useCallback(
    (draft: LessonDraft) => {
      if (!editor) {
        return;
      }
      editor.commands.setContent(draft.content, { emitUpdate: false });
      setTitle(draft.title);
      activeDraftIdRef.current = draft.id;
      draftVersionsRef.current.set(draft.id, draft.version);
      setActiveDraftId(draft.id);
      setHasSaveConflict(false);
      setSaveError("");
      setSaveStatus("Đã tải bản nháp từ máy chủ");
      setIsDraftLoaded(true);
      try {
        window.localStorage.setItem(
          `instructor-lesson-draft-${user.id}-${draft.id}`,
          JSON.stringify({ title: draft.title, content: draft.content }),
        );
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? `Không thể tạo bản dự phòng trên thiết bị: ${error.message}`
            : "Không thể tạo bản dự phòng trên thiết bị.",
        );
      }
    },
    [editor, user.id],
  );

  const applyLocalDraft = useCallback(
    (draft: LocalDraft | null) => {
      if (!editor) {
        return;
      }
      activeDraftIdRef.current = null;
      setActiveDraftId(null);
      if (draft) {
        setTitle(draft.title);
        editor.commands.setContent(draft.content, { emitUpdate: false });
      } else {
        setTitle("Bài giảng chưa có tiêu đề");
        editor.commands.setContent(emptyDocument, { emitUpdate: false });
      }
      setIsDraftLoaded(true);
    },
    [editor],
  );

  useEffect(() => {
    if (!currentUser || !editor) {
      return;
    }

    let isMounted = true;
    setIsDraftLoaded(false);

    if (
      !initializationRef.current ||
      initializationRef.current.userId !== currentUser.id
    ) {
      const promise = (async (): Promise<InitialDraftState> => {
        let localDraft: LocalDraft | null = null;
        let localDraftError: string | null = null;
        try {
          localDraft = readLocalDraft(
            `instructor-lesson-draft-${currentUser.id}`,
          );
        } catch (error) {
          localDraft = null;
          localDraftError =
            error instanceof Error
              ? error.message
              : "Không thể đọc bản nháp trên thiết bị.";
        }

        if (isMockDataMode) {
          return {
            drafts: [],
            activeDraft: null,
            localDraft,
            localDraftError,
          };
        }

        const draftList = await getLessonDraftList();
        const requestedId = Number(
          new URLSearchParams(window.location.search).get("draft_id") ?? "",
        );
        const selectedSummary =
          draftList.find((draft) => draft.id === requestedId) ?? draftList[0];

        if (selectedSummary) {
          return {
            drafts: draftList,
            activeDraft: await getLessonDraft(selectedSummary.id),
            localDraft: null,
            localDraftError,
          };
        }

        if (localDraft) {
          editor.commands.setContent(localDraft.content, { emitUpdate: false });
        } else {
          editor.commands.setContent(emptyDocument, { emitUpdate: false });
        }
        const createdDraft = await createLessonDraft({
          title: localDraft?.title ?? "Bài giảng chưa có tiêu đề",
          content: editor.getJSON(),
        });
        return {
          drafts: [createdDraft],
          activeDraft: createdDraft,
          localDraft: null,
          localDraftError,
        };
      })();
      initializationRef.current = { userId: currentUser.id, promise };
    }

    void initializationRef.current.promise
      .then((result) => {
        if (!isMounted) {
          return;
        }
        setDrafts(result.drafts);
        if (result.localDraftError) {
          setSaveError(result.localDraftError);
        }
        if (result.activeDraft) {
          setIsSyncAvailable(true);
          applyServerDraft(result.activeDraft);
          router.replace(
            `/instructor/document/editor?draft_id=${result.activeDraft.id}`,
            { scroll: false },
          );
        } else {
          applyLocalDraft(result.localDraft);
          setIsSyncAvailable(false);
          setSaveStatus(
            isMockDataMode
              ? "Chế độ mô phỏng — bản nháp chỉ lưu trên thiết bị này"
              : "Bản nháp chỉ lưu trên thiết bị này",
          );
        }
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        let localDraft: LocalDraft | null = null;
        let localDraftError: string | null = null;
        try {
          const draftId = new URLSearchParams(window.location.search).get(
            "draft_id",
          );
          localDraft = readLocalDraft(
            draftId
              ? `instructor-lesson-draft-${currentUser.id}-${draftId}`
              : `instructor-lesson-draft-${currentUser.id}`,
          );
        } catch (localError) {
          localDraftError =
            localError instanceof Error
              ? localError.message
              : "Không thể đọc bản dự phòng trên thiết bị.";
        }
        applyLocalDraft(localDraft);
        setIsSyncAvailable(false);
        setSaveStatus("Chưa đồng bộ được với máy chủ");
        setSaveError(
          [
            error instanceof Error
              ? error.message
              : "Không thể tải bản nháp từ máy chủ.",
            localDraftError,
            "Bản nháp mới sẽ tiếp tục được lưu trên thiết bị.",
          ]
            .filter(Boolean)
            .join(" "),
        );
      });

    return () => {
      isMounted = false;
    };
  }, [applyLocalDraft, applyServerDraft, currentUser, editor, router]);

  const writeLocalBackup = useCallback(
    (
      draftId: number | null,
      draftTitle: string,
      content: JSONContent,
    ): boolean => {
      if (!currentUser) {
        return false;
      }
      try {
        const key = draftId
          ? `instructor-lesson-draft-${currentUser.id}-${draftId}`
          : `instructor-lesson-draft-${currentUser.id}`;
        window.localStorage.setItem(
          key,
          JSON.stringify({ title: draftTitle, content }),
        );
        return true;
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? `Không thể lưu bản dự phòng trên thiết bị: ${error.message}`
            : "Không thể lưu bản dự phòng trên thiết bị.",
        );
        return false;
      }
    },
    [currentUser],
  );

  function enqueueServerSave(
    draftId: number,
    draftTitle: string,
    content: JSONContent,
  ): Promise<void> {
    const saveTask = saveQueueRef.current.then(async () => {
      const version = draftVersionsRef.current.get(draftId);
      if (version === undefined) {
        throw new Error("Không xác định được phiên bản bản nháp. Hãy tải lại.");
      }
      const savedDraft = await updateLessonDraft(draftId, {
        title: draftTitle,
        content,
        version,
      });
      draftVersionsRef.current.set(draftId, savedDraft.version);
      setDrafts((existingDrafts) =>
        existingDrafts.map((draft) =>
          draft.id === savedDraft.id ? savedDraft : draft,
        ),
      );
      if (activeDraftIdRef.current === draftId) {
        setSaveError("");
        setSaveStatus("Đã đồng bộ với máy chủ");
      }
    });

    saveQueueRef.current = saveTask.catch(() => undefined);
    return saveTask.catch((error: unknown) => {
      const isConflict =
        error instanceof LessonDraftApiError && error.status === 409;
      if (activeDraftIdRef.current === draftId) {
        setHasSaveConflict(isConflict);
        setSaveStatus("Đã lưu cục bộ; đồng bộ thất bại");
        setSaveError(
          error instanceof Error
            ? error.message
            : "Không thể đồng bộ bản nháp với máy chủ.",
        );
      }
      throw error;
    });
  }

  async function saveDraftNow(): Promise<boolean> {
    if (!currentUser || !editor || !isDraftLoaded) {
      return false;
    }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const content = editor.getJSON();
    const draftId = activeDraftIdRef.current;
    const backupSaved = writeLocalBackup(draftId, title, content);
    if (isMockDataMode || !isSyncAvailable) {
      setSaveStatus(
        backupSaved
          ? "Đã lưu trên thiết bị này"
          : "Lưu bản nháp trên thiết bị thất bại",
      );
      return backupSaved;
    }
    if (draftId === null) {
      setSaveStatus("Chưa có bản nháp trên máy chủ");
      setSaveError("Hãy tải lại trang để tạo bản nháp trên máy chủ.");
      return false;
    }

    setSaveStatus("Đang đồng bộ với máy chủ...");
    try {
      await enqueueServerSave(draftId, title, content);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (!currentUser || !editor || !isDraftLoaded) {
      return;
    }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      const content = editor.getJSON();
      const draftId = activeDraftIdRef.current;
      const backupSaved = writeLocalBackup(draftId, title, content);
      if (isMockDataMode || !isSyncAvailable) {
        setSaveStatus(
          backupSaved
            ? "Đã lưu trên thiết bị này"
            : "Lưu bản nháp trên thiết bị thất bại",
        );
        return;
      }
      if (hasSaveConflict) {
        setSaveStatus("Bản nháp đã lưu cục bộ; hãy tải bản mới nhất");
        return;
      }
      if (draftId === null) {
        setSaveStatus("Chưa có bản nháp trên máy chủ");
        return;
      }

      setSaveStatus("Đang đồng bộ với máy chủ...");
      void enqueueServerSave(draftId, title, content).catch(() => undefined);
    }, 800);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    currentUser,
    editor,
    editorRevision,
    isDraftLoaded,
    hasSaveConflict,
    isSyncAvailable,
    title,
    writeLocalBackup,
  ]);

  async function handleSelectDraft(draftId: number) {
    if (draftId === activeDraftIdRef.current || !editor) {
      return;
    }
    const requestId = ++loadRequestRef.current;
    const saved = await saveDraftNow();
    if (!saved) {
      return;
    }
    if (requestId !== loadRequestRef.current) {
      return;
    }
    setIsDraftLoaded(false);
    setSaveStatus("Đang tải bản nháp...");
    try {
      const draft = await getLessonDraft(draftId);
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setIsSyncAvailable(true);
      applyServerDraft(draft);
      router.replace(`/instructor/document/editor?draft_id=${draft.id}`, {
        scroll: false,
      });
    } catch (error) {
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setIsDraftLoaded(true);
      setSaveStatus("Không thể tải bản nháp");
      setSaveError(
        error instanceof Error
          ? error.message
          : "Không thể tải bản nháp từ máy chủ.",
      );
    }
  }

  async function handleCreateDraft() {
    if (!editor || isCreatingDraft) {
      return;
    }
    const requestId = ++loadRequestRef.current;
    setIsCreatingDraft(true);
    try {
      const saved = await saveDraftNow();
      if (!saved || requestId !== loadRequestRef.current) {
        return;
      }
      const draft = await createLessonDraft({
        title: "Bài giảng chưa có tiêu đề",
        content: emptyDocument,
      });
      setDrafts((existingDrafts) => [draft, ...existingDrafts]);
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setIsSyncAvailable(true);
      applyServerDraft(draft);
      router.replace(`/instructor/document/editor?draft_id=${draft.id}`, {
        scroll: false,
      });
    } catch (error) {
      setSaveStatus("Không thể tạo bản nháp");
      setSaveError(
        error instanceof Error
          ? error.message
          : "Không thể tạo bản nháp trên máy chủ.",
      );
    } finally {
      setIsCreatingDraft(false);
    }
  }

  async function reloadActiveDraft() {
    const draftId = activeDraftIdRef.current;
    if (draftId === null) {
      return;
    }
    const requestId = ++loadRequestRef.current;
    setIsDraftLoaded(false);
    setSaveStatus("Đang tải bản lưu mới nhất...");
    try {
      const draft = await getLessonDraft(draftId);
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setIsSyncAvailable(true);
      applyServerDraft(draft);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setIsDraftLoaded(true);
        setSaveStatus("Không thể tải bản nháp");
        setSaveError(
          error instanceof Error
            ? error.message
            : "Không thể tải bản nháp từ máy chủ.",
        );
      }
    }
  }

  async function exportFile(format: "pdf" | "txt" | "docx") {
    if (!editor || !isDraftLoaded || isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const saved = await saveDraftNow();
      if (!saved) {
        toast.warning(
          "Chưa đồng bộ được bản nháp với máy chủ; vẫn sẽ xuất tệp từ nội dung hiện tại.",
        );
      }

      let file: File;
      if (format === "pdf") {
        file = await createLessonPdfFile(title, editor.view.dom);
      } else if (format === "docx") {
        file = await createLessonDocx(title, editor.getJSON());
      } else {
        file = createLessonTextFile(title, editor.getJSON());
      }
      downloadLessonFile(file);
      toast.success(`Đã tải xuống tệp ${file.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể xuất văn bản thành tệp.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function replaceSelectedDocument(
    selectedDocument: InstructorDocument,
  ): Promise<void> {
    if (!editor || isReplacingDocument || !isDraftLoaded) {
      return;
    }
    if (isMockDataMode) {
      toast.info("Hãy tắt chế độ dữ liệu mô phỏng để thay tệp tài liệu thật.");
      return;
    }

    setIsReplacingDocument(true);
    let uploadedFileUrl: string | null = null;
    try {
      const saved = await saveDraftNow();
      if (!saved) {
        toast.error("Chưa đồng bộ được bản nháp. Không thay tệp tài liệu.");
        return;
      }

      const file =
        selectedDocument.document_type === "pdf"
          ? await createLessonPdfFile(title, editor.view.dom)
          : replacementFormat === "docx"
            ? await createLessonDocx(title, editor.getJSON())
            : createLessonTextFile(title, editor.getJSON());
      const upload = await uploadNewDocumentFile(
        file,
        selectedDocument.document_type,
      );
      uploadedFileUrl = upload.file_url;

      try {
        const updatedDocument = await updateInstructorDocument(
          selectedDocument.id,
          {
            title: selectedDocument.title,
            content: selectedDocument.content ?? "",
            document_type: selectedDocument.document_type,
            file_url: uploadedFileUrl,
            course_id: selectedDocument.course_id ?? undefined,
            module_id: selectedDocument.module_id ?? undefined,
          },
        );
        setDocuments((existingDocuments) =>
          existingDocuments.map((document) =>
            document.id === updatedDocument.id
              ? { ...document, ...updatedDocument }
              : document,
          ),
        );
      } catch (error) {
        try {
          await deleteOldUploadedFile(uploadedFileUrl);
        } catch (cleanupError) {
          toast.warning(
            cleanupError instanceof Error
              ? `Cập nhật thất bại và không xóa được tệp tải lên tạm: ${cleanupError.message}`
              : "Cập nhật thất bại và không xóa được tệp tải lên tạm.",
          );
        }
        throw error;
      }

      try {
        if (selectedDocument.file_url !== uploadedFileUrl) {
          await deleteOldUploadedFile(selectedDocument.file_url);
        }
      } catch (error) {
        toast.warning(
          error instanceof Error
            ? `Đã thay tệp tài liệu nhưng không xóa được tệp cũ: ${error.message}`
            : "Đã thay tệp tài liệu nhưng không xóa được tệp cũ.",
        );
      }

      toast.success(
        `Đã thay tệp của tài liệu “${selectedDocument.title}”.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể thay tệp tài liệu.",
      );
    } finally {
      setIsReplacingDocument(false);
    }
  }

  function confirmDocumentReplacement() {
    const selectedDocument = documents.find(
      (document) => document.id === selectedDocumentId,
    );
    if (!selectedDocument) {
      toast.error("Vui lòng chọn tài liệu cần thay tệp.");
      return;
    }
    if (isReplacingDocument) {
      return;
    }

    const fileFormat =
      selectedDocument.document_type === "pdf"
        ? "PDF"
        : replacementFormat.toUpperCase();

    toast.warning(
      ({ closeToast }) => (
        <div className="space-y-3">
          <p>
            Thay tệp hiện tại của “{selectedDocument.title}” bằng bản soạn
            dạng {fileFormat}? Tệp cũ sẽ bị xóa sau khi thay thế thành công.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => closeToast?.()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                closeToast?.();
                void replaceSelectedDocument(selectedDocument);
              }}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
            >
              Thay tệp
            </button>
          </div>
        </div>
      ),
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
      },
    );
  }

  async function returnToDocumentList() {
    await saveDraftNow();
    router.push("/instructor/document");
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
    <main className={`${styles.page} min-h-screen bg-slate-100 text-slate-900`}>
      <ShowNavigation
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Đóng lớp nền điều hướng"
          className={`${styles.sidebarOverlay} fixed inset-0 z-40 bg-slate-950/40`}
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <header className={`${styles.header} fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur`}>
        <div className="flex min-w-0 items-center gap-3">
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
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">Soạn thảo bài giảng</h1>
            <p className="hidden text-sm text-slate-500 sm:block">
              Soạn nội dung và đồng bộ bản nháp của bạn
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className={`${styles.printable} mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 pb-8 pt-24 sm:px-6`}>
        <div className={`${styles.actions} flex flex-wrap items-center justify-between gap-3`}>
          <button
            type="button"
            onClick={() => void returnToDocumentList()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách tài liệu
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {!isMockDataMode ? (
              <>
                <label htmlFor="saved-draft" className="sr-only">
                  Chọn bản nháp
                </label>
                <select
                  id="saved-draft"
                  value={activeDraftId ?? ""}
                  disabled={!drafts.length || !isDraftLoaded || isCreatingDraft}
                  onChange={(event) => {
                    const selectedId = Number(event.target.value);
                    if (Number.isSafeInteger(selectedId) && selectedId > 0) {
                      void handleSelectDraft(selectedId);
                    }
                  }}
                  className="max-w-52 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:opacity-50"
                >
                  {drafts.length === 0 ? (
                    <option value="">Chưa có bản nháp</option>
                  ) : null}
                  {drafts.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      {draft.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleCreateDraft()}
                  disabled={!isSyncAvailable || !isDraftLoaded || isCreatingDraft}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingDraft ? "Đang tạo..." : "Bản nháp mới"}
                </button>
              </>
            ) : null}
            <p role="status" aria-live="polite" className="text-sm text-slate-500">
              {saveStatus}
            </p>
            <button
              type="button"
              onClick={() => void saveDraftNow()}
              disabled={!isDraftLoaded}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Save className="h-4 w-4" />
              Lưu nháp
            </button>
            <button
              type="button"
              onClick={() => void exportFile("pdf")}
              disabled={!isDraftLoaded || isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Đang xuất..." : "Tải PDF"}
            </button>
            <button
              type="button"
              onClick={() => void exportFile("txt")}
              disabled={!isDraftLoaded || isExporting}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Tải TXT
            </button>
            <button
              type="button"
              onClick={() => void exportFile("docx")}
              disabled={!isDraftLoaded || isExporting}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Tải DOCX
            </button>
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="replace-document"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <Share className="h-4 w-4" />
              Thay tệp trong tài liệu của khóa học
            </label>
            <select
              id="replace-document"
              value={selectedDocumentId ?? ""}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                setSelectedDocumentId(
                  Number.isSafeInteger(nextId) && nextId > 0 ? nextId : null,
                );
              }}
              disabled={!documents.length || isReplacingDocument}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:opacity-50"
            >
              <option value="">
                {documents.length
                  ? "Chọn tài liệu cần thay tệp"
                  : "Không có tài liệu PDF hoặc tài liệu khác"}
              </option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  [{document.document_type.toUpperCase()}] {document.title} — {document.course_name}
                </option>
              ))}
            </select>
            {documentListError ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {documentListError}
              </p>
            ) : null}
            {!documentListError && !documents.length && isDraftLoaded ? (
            <p className="mt-2 text-sm text-slate-500">
              Danh sách chỉ gồm tài liệu thuộc khóa học của bạn có loại PDF hoặc Tài liệu khác.
            </p>
            ) : null}
          </div>
          {documents.find((document) => document.id === selectedDocumentId)
            ?.document_type === "other" ? (
            <label className="block text-sm font-medium text-slate-700">
              Định dạng
              <select
                value={replacementFormat}
                onChange={(event) =>
                  setReplacementFormat(event.target.value as "docx" | "txt")
                }
                disabled={isReplacingDocument}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
              >
                <option value="docx">Word (.docx)</option>
                <option value="txt">Văn bản (.txt)</option>
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={confirmDocumentReplacement}
            disabled={
              !selectedDocumentId ||
              !isDraftLoaded ||
              isReplacingDocument ||
              isExporting
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReplacingDocument ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isReplacingDocument ? "Đang thay tệp..." : "Thay tệp tài liệu"}
          </button>
        </section>

        {saveError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{saveError}</p>
            {hasSaveConflict ? (
              <button
                type="button"
                onClick={() => void reloadActiveDraft()}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-800 hover:bg-red-100"
              >
                Tải bản mới nhất
              </button>
            ) : null}
          </div>
        ) : null}

        <section className={`${styles.printArea} overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200`}>
          <div className="border-b border-slate-200 px-5 py-4 sm:px-8">
            <label htmlFor="lesson-title" className="sr-only">
              Tiêu đề bài giảng
            </label>
            <input
              id="lesson-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!isDraftLoaded}
              placeholder="Nhập tiêu đề bài giảng"
              className="w-full border-0 bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-400 sm:text-3xl"
            />
            <h1 className={styles.printTitle}>{title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {isMockDataMode
                ? "Chế độ mô phỏng: bản nháp chỉ được lưu trên trình duyệt này."
                : isSyncAvailable
                  ? "Bản nháp tự động đồng bộ lên máy chủ và có bản dự phòng trên thiết bị."
                  : "Máy chủ chưa kết nối; nội dung mới được lưu tạm trên thiết bị này."}
            </p>
          </div>

          <div className={`${styles.toolbar} flex flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-3 ${!isDraftLoaded ? "pointer-events-none opacity-50" : ""}`}>
            <ToolbarButton
              label="Đậm"
              active={editor?.isActive("bold")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Nghiêng"
              active={editor?.isActive("italic")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Gạch ngang"
              active={editor?.isActive("strike")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Gạch chân"
              active={editor?.isActive("underline")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <Underline className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Mã nội dòng"
              active={editor?.isActive("code")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <label
              title="Màu chữ"
              className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40"
            >
              <Baseline className="h-4 w-4" />
              <span
                aria-hidden="true"
                className="absolute bottom-1 right-1.5 h-1 w-3.5 rounded-full"
                style={{ backgroundColor: activeTextColor }}
              />
              <input
                type="color"
                aria-label="Màu chữ"
                value={activeTextColor}
                disabled={!editor}
                onChange={(event) =>
                  editor?.chain().focus().setColor(event.target.value).run()
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <ToolbarButton
              label="Tô sáng"
              active={editor?.isActive("highlight")}
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().toggleHighlight({ color: "#fde68a" }).run()
              }
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            <span className="mx-1 h-6 border-l border-slate-200" aria-hidden="true" />
            <select
              aria-label="Kiểu đoạn văn"
              title="Kiểu đoạn văn"
              value={paragraphStyle}
              disabled={!editor}
              onChange={(event) => {
                const chain = editor?.chain().focus();
                const value = event.target.value;
                if (value === "paragraph") {
                  chain?.setParagraph().run();
                  return;
                }
                const level = Number(value.slice(1)) as 1 | 2 | 3;
                chain?.setHeading({ level }).run();
              }}
              className={toolbarSelectClass}
            >
              <option value="paragraph">Đoạn văn</option>
              <option value="h1">Tiêu đề 1</option>
              <option value="h2">Tiêu đề 2</option>
              <option value="h3">Tiêu đề 3</option>
            </select>
            <select
              aria-label="Cỡ chữ"
              title="Cỡ chữ"
              value={activeFontSize}
              disabled={!editor}
              onChange={(event) => {
                const size = event.target.value;
                const chain = editor?.chain().focus();
                if (size) {
                  chain?.setFontSize(size).run();
                } else {
                  chain?.unsetFontSize().run();
                }
              }}
              className={toolbarSelectClass}
            >
              <option value="">Cỡ chữ</option>
              {FONT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size.replace("pt", "")}
                </option>
              ))}
            </select>
            <span className="mx-1 h-6 border-l border-slate-200" aria-hidden="true" />
            <ToolbarButton
              label="Căn trái"
              active={editor?.isActive({ textAlign: "left" })}
              disabled={!editor}
              onClick={() => applyAlignment("left")}
            >
              <TextAlignStart className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Căn giữa"
              active={editor?.isActive({ textAlign: "center" })}
              disabled={!editor}
              onClick={() => applyAlignment("center")}
            >
              <TextAlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Căn phải"
              active={editor?.isActive({ textAlign: "right" })}
              disabled={!editor}
              onClick={() => applyAlignment("right")}
            >
              <TextAlignEnd className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Căn đều hai bên"
              active={editor?.isActive({ textAlign: "justify" })}
              disabled={!editor}
              onClick={() => applyAlignment("justify")}
            >
              <TextAlignJustify className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Danh sách dấu đầu dòng"
              active={editor?.isActive("bulletList")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Danh sách đánh số"
              active={editor?.isActive("orderedList")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Tăng thụt lề"
              disabled={!editor || !editor.can().sinkListItem("listItem")}
              onClick={() => editor?.chain().focus().sinkListItem("listItem").run()}
            >
              <ListIndentIncrease className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Giảm thụt lề"
              disabled={!editor || !editor.can().liftListItem("listItem")}
              onClick={() => editor?.chain().focus().liftListItem("listItem").run()}
            >
              <ListIndentDecrease className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Trích dẫn"
              active={editor?.isActive("blockquote")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Khối mã"
              active={editor?.isActive("codeBlock")}
              disabled={!editor}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <SquareCode className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Đường kẻ ngang"
              disabled={!editor}
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>
            <div className="relative">
              <ToolbarButton
                label="Chèn liên kết"
                active={editor?.isActive("link")}
                disabled={!editor}
                onClick={openLinkMenu}
              >
                <Link2 className="h-4 w-4" />
              </ToolbarButton>
              {isLinkMenuOpen ? (
                <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
                  <label
                    htmlFor="lesson-link-url"
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Địa chỉ liên kết
                  </label>
                  <input
                    id="lesson-link-url"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyLink();
                      }
                      if (event.key === "Escape") {
                        setIsLinkMenuOpen(false);
                      }
                    }}
                    placeholder="https://vi-du.com"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={removeLink}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Unlink2 className="h-3.5 w-3.5" />
                      Bỏ liên kết
                    </button>
                    <button
                      type="button"
                      onClick={applyLink}
                      className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <ToolbarButton
              label="Xóa định dạng"
              disabled={!editor}
              onClick={() =>
                editor?.chain().focus().unsetAllMarks().clearNodes().run()
              }
            >
              <Eraser className="h-4 w-4" />
            </ToolbarButton>
            <span className="mx-1 h-6 border-l border-slate-200" aria-hidden="true" />
            <ToolbarButton
              label="Hoàn tác"
              disabled={!editor || !editor.can().undo()}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Làm lại"
              disabled={!editor || !editor.can().redo()}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
            <span className="mx-1 h-6 border-l border-slate-200" aria-hidden="true" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsWriterMenuOpen((isOpen) => !isOpen)}
                disabled={!isDraftLoaded || isGeneratingWriterText}
                aria-haspopup="menu"
                aria-expanded={isWriterMenuOpen}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Trợ lý AI
                <ChevronDown className="h-4 w-4" />
              </button>
              {isWriterMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Chức năng trợ lý AI"
                  className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                >
                  {(
                    [
                      ["continue_from_outline", "Viết tiếp từ dàn ý"],
                      ["rewrite_selection", "Soạn lại đoạn đang chọn"],
                      ["learning_objectives", "Tạo mục tiêu học tập"],
                      ["create_activity", "Tạo hoạt động học tập"],
                      ["create_questions", "Tạo câu hỏi ôn tập"],
                      ["generate_from_document", "Sinh nội dung từ tài liệu"],
                    ] as const
                  ).map(([action, label]) => (
                    <button
                      key={action}
                      type="button"
                      role="menuitem"
                      onClick={() => openWritingAssistant(action)}
                      className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-900"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {writerAction ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeWritingAssistant();
                }
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="lesson-writer-title"
                className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="lesson-writer-title"
                      className="text-xl font-semibold text-slate-900"
                    >
                      {writerAction === "continue_from_outline"
                        ? "Viết tiếp từ dàn ý"
                        : writerAction === "rewrite_selection"
                          ? "Soạn lại đoạn đang chọn"
                          : writerAction === "learning_objectives"
                            ? "Tạo mục tiêu học tập"
                            : writerAction === "create_activity"
                              ? "Tạo hoạt động học tập"
                              : writerAction === "create_questions"
                                ? "Tạo câu hỏi ôn tập"
                                : "Sinh nội dung từ tài liệu"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Xem lại bản nháp trước khi chèn vào bài giảng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeWritingAssistant}
                    disabled={isGeneratingWriterText}
                    aria-label="Đóng trợ lý AI"
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Đóng
                  </button>
                </div>

                {writerAction === "continue_from_outline" ? (
                  <label className="mb-4 block text-sm font-medium text-slate-800">
                    Dàn ý cần viết tiếp
                    <textarea
                      value={writerOutline}
                      onChange={(event) => setWriterOutline(event.target.value)}
                      maxLength={8_000}
                      rows={5}
                      placeholder={"1. Khái niệm chính\n2. Ví dụ minh họa\n3. Luyện tập"}
                      className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    />
                  </label>
                ) : null}

                {writerAction === "generate_from_document" ? (
                  <label className="mb-4 block text-sm font-medium text-slate-800">
                    Tài liệu nguồn
                    <select
                      value={writerDocumentId ?? ""}
                      onChange={(event) => {
                        const documentId = Number(event.target.value);
                        setWriterFile(null);
                        setWriterDocumentId(
                          Number.isSafeInteger(documentId) && documentId > 0
                            ? documentId
                            : null,
                        );
                      }}
                      className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal"
                    >
                      <option value="">Chọn tài liệu</option>
                      {documents
                        .filter(isSupportedLessonSource)
                        .map((document) => (
                          <option key={document.id} value={document.id}>
                            {document.title} — {document.course_name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                {writerAction === "generate_from_document" ? (
                  <label className="mb-4 block text-sm font-medium text-slate-800">
                    Hoặc tải tài liệu lên (tối đa 4 MB)
                    <input
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        if (file && file.size > 4 * 1024 * 1024) {
                          setWriterError("Tệp tải lên không được vượt quá 4 MB.");
                          event.target.value = "";
                          return;
                        }
                        setWriterError("");
                        setWriterFile(file);
                        if (file) {
                          setWriterDocumentId(null);
                        }
                      }}
                      className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:font-medium file:text-violet-800"
                    />
                  </label>
                ) : null}

                <label className="mb-4 block text-sm font-medium text-slate-800">
                  Yêu cầu bổ sung (không bắt buộc)
                  <textarea
                    value={writerInstructions}
                    onChange={(event) => setWriterInstructions(event.target.value)}
                    maxLength={1_200}
                    rows={2}
                    placeholder="Ví dụ: phù hợp với học sinh lớp 8, dùng ví dụ gần gũi"
                    className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  {writerAction === "generate_from_document"
                    ? "Chỉ văn bản trích xuất sẽ được gửi đến Gemini. Tệp tải lên chỉ được xử lý tạm thời và không được lưu."
                    : writerAction === "rewrite_selection"
                      ? "Chỉ đoạn văn bản bạn đã chọn được gửi đến Gemini."
                      : "Nội dung bài giảng liên quan sẽ được gửi đến Gemini qua backend để xử lý."}
                </p>

                {writerError ? (
                  <p className="mb-4 text-sm text-red-700" role="alert">
                    {writerError}
                  </p>
                ) : null}

                {writerPreview ? (
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">
                      Bản nháp AI
                    </h3>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-violet-200 bg-violet-50 p-4 font-sans text-sm leading-6 text-slate-800">
                      {writerPreview}
                    </pre>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeWritingAssistant}
                    disabled={isGeneratingWriterText}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Bỏ qua
                  </button>
                  {writerPreview ? (
                    <button
                      type="button"
                      onClick={applyWritingPreview}
                      className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                    >
                      {writerAction === "rewrite_selection"
                        ? "Chấp nhận và thay đoạn"
                        : "Chấp nhận và chèn"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void generateWritingPreview()}
                      disabled={
                        isGeneratingWriterText ||
                        (writerAction === "continue_from_outline" &&
                          !writerOutline.trim()) ||
                        (writerAction === "generate_from_document" &&
                          writerDocumentId === null &&
                          writerFile === null)
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGeneratingWriterText ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isGeneratingWriterText ? "Đang tạo..." : "Tạo bản nháp"}
                    </button>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          <div
            className={`${styles.editorContent} px-5 py-6 sm:px-8`}
            aria-busy={!isDraftLoaded}
          >
            <EditorContent editor={editor} />
          </div>
          <div
            className={`${styles.editorFooter} flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-2 text-xs text-slate-500 sm:px-8`}
          >
            <span>{wordCount} từ</span>
            <span aria-hidden="true">•</span>
            <span>{editorText.length} ký tự</span>
          </div>
        </section>

        <p className={`${styles.printHint} text-center text-xs text-slate-500`}>
          Khi chọn In / lưu PDF, hãy chọn “Lưu dưới dạng PDF” trong hộp thoại in của trình duyệt.
        </p>
      </section>
    </main>
  );
}
