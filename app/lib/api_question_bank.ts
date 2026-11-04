import type { ExamQuestion, ExamOption } from "./api_exam";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_QUESTION_BANK_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

/** Loại câu hỏi được phép đăng lên ngân hàng câu hỏi chung. */
export type QuestionBankQuestionType =
  | "multiple_choice"
  | "multiple_answer"
  | "fill_in_blank"
  | "true_false";

export type QuestionBankSort =
  | "newest"
  | "oldest"
  | "rating"
  | "popular"
  | "content_az";

export type QuestionBankOption = {
  id?: number;
  content: string;
  is_correct: boolean;
};

export type QuestionBankItem = {
  id: number;
  content: string;
  question_type: string;
  answer: string;
  bloom_level: string;
  score: number;
  category_id: number | null;
  category_name: string | null;
  created_by: number;
  created_by_name: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  rating_average: number;
  rating_count: number;
  my_rating: number | null;
  options: QuestionBankOption[];
};

export type QuestionBankPage = {
  items: QuestionBankItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  sort: string;
};

export type QuestionBankTagSummary = {
  tag: string;
  count: number;
};

export type QuestionBankDraft = {
  content: string;
  question_type: QuestionBankQuestionType;
  answer: string;
  bloom_level: string;
  score: number;
  category_id: number | null;
  is_active: boolean;
  tags: string[];
  options: QuestionBankOption[];
};

export type QuestionBankFilters = {
  keyword: string;
  categoryId: string;
  questionType: string;
  bloomLevel: string;
  tag: string;
  onlyMine: boolean;
};

export type QuestionBankQuery = {
  search?: string;
  categoryId?: string;
  questionType?: string;
  bloomLevel?: string;
  tag?: string;
  onlyMineUserId?: number;
  includeInactive?: boolean;
  viewerId?: number;
  sort?: QuestionBankSort;
  page?: number;
  pageSize?: number;
};

export type QuestionBankImportResult = {
  exam_id: number;
  imported: number;
  skipped: number;
  question_ids: number[];
};

export type PublishQuestionInput = {
  questionId: number;
  createdBy: number;
  categoryId?: number | null;
  score?: number;
  tags?: string[];
  /** Dữ liệu câu hỏi dùng cho chế độ mock (không cần khi gọi API thật). */
  preview?: {
    question: Pick<
      ExamQuestion,
      "content" | "question_type" | "answer" | "bloom_level" | "score"
    >;
    options?: Pick<ExamOption, "content" | "is_correct">[];
  };
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  list: `${API_BASE_URL}/question_bank/`,
  tags: `${API_BASE_URL}/question_bank/tags`,
  detail: (bankId: number) => `${API_BASE_URL}/question_bank/${bankId}`,
  create: `${API_BASE_URL}/question_bank/create`,
  update: (bankId: number, userId: number) =>
    `${API_BASE_URL}/question_bank/update/${bankId}?user_id=${userId}`,
  remove: (bankId: number, userId: number) =>
    `${API_BASE_URL}/question_bank/delete/${bankId}?user_id=${userId}`,
  publish: `${API_BASE_URL}/question_bank/publish`,
  import: `${API_BASE_URL}/question_bank/import`,
  rating: (bankId: number) => `${API_BASE_URL}/question_bank/${bankId}/rating`,
};

export const MAX_QUESTION_BANK_TAGS = 8;
const MAX_TAG_LENGTH = 40;

const mockCategoryNames: Record<number, string> = {
  1: "Lập trình web",
  2: "Trí tuệ nhân tạo",
  3: "Khoa học dữ liệu",
};

type MockBankSeed = Omit<
  QuestionBankItem,
  "tags" | "rating_average" | "rating_count" | "my_rating"
> & { tags?: string[] };

/** userId -> bankId -> số sao */
let mockRatings: Record<number, Record<number, number>> = {
  7: { 501: 5, 505: 4 },
  8: { 501: 4, 503: 5, 506: 3 },
  9: { 503: 4, 504: 5, 506: 4 },
};

let mockQuestionBank: MockBankSeed[] = [
  {
    id: 501,
    content: "Ngôn ngữ lập trình nào chạy trực tiếp trong trình duyệt?",
    question_type: "multiple_choice",
    answer: "JavaScript",
    bloom_level: "remember",
    score: 2,
    category_id: 1,
    category_name: "Lập trình web",
    created_by: 8,
    created_by_name: "Lê Hoàng Minh",
    is_active: true,
    usage_count: 24,
    created_at: "2026-09-02T08:10:00+00:00",
    updated_at: "2026-09-02T08:10:00+00:00",
    tags: ["javascript", "frontend"],
    options: [
      { id: 9001, content: "JavaScript", is_correct: true },
      { id: 9002, content: "Python", is_correct: false },
      { id: 9003, content: "C#", is_correct: false },
      { id: 9004, content: "SQL", is_correct: false },
    ],
  },
  {
    id: 502,
    content: "Những thành phần nào thuộc kiến trúc của một ứng dụng Next.js?",
    question_type: "multiple_answer",
    answer: "App Router | Server Components",
    bloom_level: "understand",
    score: 3,
    category_id: 1,
    category_name: "Lập trình web",
    created_by: 7,
    created_by_name: "Nguyễn Thiên Long",
    is_active: true,
    usage_count: 12,
    created_at: "2026-09-08T09:30:00+00:00",
    updated_at: "2026-09-10T07:00:00+00:00",
    tags: ["nextjs", "frontend"],
    options: [
      { id: 9005, content: "App Router", is_correct: true },
      { id: 9006, content: "Server Components", is_correct: true },
      { id: 9007, content: "Windows Registry", is_correct: false },
      { id: 9008, content: "BIOS", is_correct: false },
    ],
  },
  {
    id: 503,
    content: "Thủ đô của Việt Nam là ___.",
    question_type: "fill_in_blank",
    answer: "Hà Nội ~ HN",
    bloom_level: "remember",
    score: 1,
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    created_by: 9,
    created_by_name: "Trần Hải Yến",
    is_active: true,
    usage_count: 40,
    created_at: "2026-08-21T03:15:00+00:00",
    updated_at: "2026-08-21T03:15:00+00:00",
    tags: ["địa lý"],
    options: [],
  },
  {
    id: 504,
    content:
      "Mô hình học máy ___ được dùng phổ biến cho bài toán phân loại văn bản.",
    question_type: "fill_in_blank",
    answer: "Naive Bayes ~ NB | SVM",
    bloom_level: "apply",
    score: 4,
    category_id: 2,
    category_name: "Trí tuệ nhân tạo",
    created_by: 8,
    created_by_name: "Lê Hoàng Minh",
    is_active: true,
    usage_count: 6,
    created_at: "2026-09-18T11:45:00+00:00",
    updated_at: "2026-09-18T11:45:00+00:00",
    tags: ["machine learning", "phân loại"],
    options: [],
  },
  {
    id: 505,
    content: "FastAPI mặc định sinh tài liệu API ở đường dẫn /docs.",
    question_type: "true_false",
    answer: "Đúng",
    bloom_level: "understand",
    score: 1,
    category_id: 1,
    category_name: "Lập trình web",
    created_by: 7,
    created_by_name: "Nguyễn Thiên Long",
    is_active: true,
    usage_count: 18,
    created_at: "2026-09-25T02:20:00+00:00",
    updated_at: "2026-09-25T02:20:00+00:00",
    tags: ["fastapi", "backend"],
    options: [
      { id: 9009, content: "Đúng", is_correct: true },
      { id: 9010, content: "Sai", is_correct: false },
    ],
  },
  {
    id: 506,
    content: "Khi nào nên chuẩn hóa dữ liệu trước khi huấn luyện mô hình?",
    question_type: "multiple_choice",
    answer: "Khi các đặc trưng có đơn vị đo khác nhau",
    bloom_level: "analyze",
    score: 3,
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    created_by: 9,
    created_by_name: "Trần Hải Yến",
    is_active: true,
    usage_count: 9,
    created_at: "2026-10-01T06:40:00+00:00",
    updated_at: "2026-10-01T06:40:00+00:00",
    tags: ["machine learning", "tiền xử lý"],
    options: [
      {
        id: 9011,
        content: "Khi các đặc trưng có đơn vị đo khác nhau",
        is_correct: true,
      },
      { id: 9012, content: "Khi dữ liệu đã cân bằng hoàn hảo", is_correct: false },
      { id: 9013, content: "Khi không dùng mô hình học máy", is_correct: false },
    ],
  },
  {
    id: 507,
    content: "Chọn các bước hợp lệ trong quy trình đánh giá mô hình.",
    question_type: "multiple_answer",
    answer: "Chia tập train/test | Đo chỉ số trên tập test",
    bloom_level: "evaluate",
    score: 4,
    category_id: 2,
    category_name: "Trí tuệ nhân tạo",
    created_by: 8,
    created_by_name: "Lê Hoàng Minh",
    is_active: true,
    usage_count: 3,
    created_at: "2026-10-05T09:05:00+00:00",
    updated_at: "2026-10-05T09:05:00+00:00",
    tags: ["machine learning", "đánh giá"],
    options: [
      { id: 9014, content: "Chia tập train/test", is_correct: true },
      { id: 9015, content: "Đo chỉ số trên tập test", is_correct: true },
      { id: 9016, content: "Đo chỉ số trên tập train", is_correct: false },
    ],
  },
  {
    id: 508,
    content: "Câu hỏi nháp chưa muốn chia sẻ cho đồng nghiệp.",
    question_type: "multiple_choice",
    answer: "A",
    bloom_level: "remember",
    score: 1,
    category_id: 1,
    category_name: "Lập trình web",
    created_by: 7,
    created_by_name: "Nguyễn Thiên Long",
    is_active: false,
    usage_count: 0,
    created_at: "2026-10-12T04:00:00+00:00",
    updated_at: "2026-10-12T04:00:00+00:00",
    tags: ["nháp"],
    options: [
      { id: 9017, content: "A", is_correct: true },
      { id: 9018, content: "B", is_correct: false },
    ],
  },
];

// Thêm vài câu hỏi mẫu để trang ngân hàng có nhiều hơn một trang khi chạy mock.
for (let index = 0; index < 8; index += 1) {
  const seedId = 509 + index;
  mockQuestionBank.push({
    id: seedId,
    content: `Câu hỏi ôn tập mẫu số ${index + 1} về ${index % 2 === 0 ? "cơ sở dữ liệu" : "lập trình"}`,
    question_type: "multiple_choice",
    answer: "Đáp án đúng",
    bloom_level: index % 2 === 0 ? "understand" : "apply",
    score: 2,
    category_id: index % 2 === 0 ? 3 : 1,
    category_name: index % 2 === 0 ? "Khoa học dữ liệu" : "Lập trình web",
    created_by: index % 2 === 0 ? 8 : 9,
    created_by_name: index % 2 === 0 ? "Lê Hoàng Minh" : "Trần Hải Yến",
    is_active: true,
    usage_count: 5 + index,
    created_at: `2026-09-${String(10 + index).padStart(2, "0")}T08:00:00+00:00`,
    updated_at: `2026-09-${String(10 + index).padStart(2, "0")}T08:00:00+00:00`,
    tags: index % 2 === 0 ? ["cơ sở dữ liệu", "sql"] : ["lập trình"],
    options: [
      { id: seedId * 100, content: "Đáp án đúng", is_correct: true },
      { id: seedId * 100 + 1, content: "Đáp án sai", is_correct: false },
    ],
  });
}

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse để dùng thông báo mặc định.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function getJsonOrFallback<T>(url: string, fallback: T): Promise<T> {
  try {
    return await getJson<T>(url);
  } catch {
    return fallback;
  }
}

async function sendJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

/** Chuẩn hóa thẻ/chủ đề: bỏ rỗng, gộp trùng, giới hạn số lượng và độ dài. */
export function normalizeQuestionBankTags(tags: string[]): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of tags) {
    for (const part of String(rawTag).replace(/;/g, ",").split(",")) {
      const tag = part.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH).trim();
      if (!tag) {
        continue;
      }
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cleaned.push(tag);
      if (cleaned.length >= MAX_QUESTION_BANK_TAGS) {
        return cleaned;
      }
    }
  }

  return cleaned;
}

export function defaultQuestionBankDraft(): QuestionBankDraft {
  return {
    content: "",
    question_type: "multiple_choice",
    answer: "",
    bloom_level: "remember",
    score: 1,
    category_id: null,
    is_active: true,
    tags: [],
    options: [
      { content: "", is_correct: true },
      { content: "", is_correct: false },
    ],
  };
}

/**
 * Kiểm tra dữ liệu câu hỏi trước khi đăng lên ngân hàng chung.
 * Trả về thông báo lỗi hoặc null khi hợp lệ.
 */
export function validateQuestionBankDraft(draft: QuestionBankDraft): string | null {
  if (!draft.content.trim()) {
    return "Nội dung câu hỏi không được để trống.";
  }

  if (!Number.isFinite(draft.score) || draft.score < 0) {
    return "Điểm của câu hỏi không được nhỏ hơn 0.";
  }

  if (normalizeQuestionBankTags(draft.tags).length !== draft.tags.length) {
    return "Thẻ/chủ đề bị trùng hoặc vượt quá giới hạn cho phép.";
  }

  if (draft.question_type === "fill_in_blank") {
    if (!draft.answer.trim()) {
      return "Câu hỏi điền chỗ trống cần đáp án.";
    }
    return null;
  }

  const options = draft.options.filter((option) => option.content.trim() !== "");
  if (options.length < 2) {
    return "Câu hỏi có phương án cần ít nhất 2 phương án trả lời.";
  }

  const normalizedContents = options.map((option) => option.content.trim().toLowerCase());
  if (new Set(normalizedContents).size !== normalizedContents.length) {
    return "Các phương án không được trùng nội dung.";
  }

  const correctCount = options.filter((option) => option.is_correct).length;

  if (draft.question_type === "multiple_answer") {
    if (correctCount < 2) {
      return "Câu hỏi nhiều đáp án cần ít nhất 2 phương án đúng.";
    }
    if (correctCount === options.length) {
      return "Câu hỏi nhiều đáp án cần ít nhất 1 phương án sai.";
    }
    return null;
  }

  if (draft.question_type === "true_false" && options.length !== 2) {
    return "Câu hỏi Đúng/Sai cần đúng 2 phương án.";
  }

  if (correctCount !== 1) {
    return "Câu hỏi một đáp án cần đúng một phương án đúng.";
  }

  return null;
}

/** Câu hỏi có đang hiển thị với người dùng hiện tại không. */
export function isQuestionBankItemVisible(
  item: QuestionBankItem,
  currentUserId: number,
): boolean {
  return item.is_active || item.created_by === currentUserId;
}

export function filterQuestionBankItems(
  items: QuestionBankItem[],
  filters: QuestionBankFilters,
  currentUserId: number,
): QuestionBankItem[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return items.filter((item) => {
    if (!isQuestionBankItemVisible(item, currentUserId)) {
      return false;
    }
    if (filters.onlyMine && item.created_by !== currentUserId) {
      return false;
    }

    const matchesKeyword =
      keyword.length === 0 ||
      item.content.toLowerCase().includes(keyword) ||
      item.answer.toLowerCase().includes(keyword) ||
      item.created_by_name.toLowerCase().includes(keyword) ||
      (item.category_name ?? "").toLowerCase().includes(keyword) ||
      item.tags.some((tag) => tag.toLowerCase().includes(keyword));

    const matchesCategory =
      filters.categoryId === "all" || `${item.category_id}` === filters.categoryId;

    const matchesType =
      filters.questionType === "all" ||
      item.question_type === filters.questionType;

    const matchesBloom =
      filters.bloomLevel === "all" || item.bloom_level === filters.bloomLevel;

    const matchesTag =
      !filters.tag ||
      item.tags.some(
        (tag) => tag.toLowerCase() === filters.tag.trim().toLowerCase(),
      );

    return (
      matchesKeyword &&
      matchesCategory &&
      matchesType &&
      matchesBloom &&
      matchesTag
    );
  });
}

// ── Mock helpers ────────────────────────────────────────

function getMockRatingStats(bankId: number): { average: number; count: number } {
  const ratings = Object.values(mockRatings)
    .map((byUser) => byUser[bankId])
    .filter((value): value is number => typeof value === "number");

  if (ratings.length === 0) {
    return { average: 0, count: 0 };
  }

  const total = ratings.reduce((sum, value) => sum + value, 0);
  return {
    average: Math.round((total / ratings.length) * 10) / 10,
    count: ratings.length,
  };
}

function getMockMyRating(bankId: number, viewerId?: number): number | null {
  if (!viewerId) {
    return null;
  }
  return mockRatings[viewerId]?.[bankId] ?? null;
}

function buildMockItem(seed: MockBankSeed, viewerId?: number): QuestionBankItem {
  const stats = getMockRatingStats(seed.id);
  return {
    ...seed,
    tags: [...(seed.tags ?? [])],
    rating_average: stats.average,
    rating_count: stats.count,
    my_rating: getMockMyRating(seed.id, viewerId),
    options: seed.options.map((option) => ({ ...option })),
  };
}

function getMockVisibleSeeds(query: QuestionBankQuery): MockBankSeed[] {
  const viewerId = query.viewerId;

  return mockQuestionBank.filter((item) => {
    if (query.includeInactive && viewerId) {
      if (!item.is_active && item.created_by !== viewerId) {
        return false;
      }
    } else if (!item.is_active) {
      return false;
    }

    if (query.onlyMineUserId && item.created_by !== query.onlyMineUserId) {
      return false;
    }

    const keyword = (query.search ?? "").trim().toLowerCase();
    if (keyword) {
      const matchesKeyword =
        item.content.toLowerCase().includes(keyword) ||
        item.answer.toLowerCase().includes(keyword) ||
        (item.category_name ?? "").toLowerCase().includes(keyword) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(keyword));
      if (!matchesKeyword) {
        return false;
      }
    }

    if (query.categoryId && `${item.category_id}` !== query.categoryId) {
      return false;
    }

    if (query.questionType && item.question_type !== query.questionType) {
      return false;
    }

    if (query.bloomLevel && item.bloom_level !== query.bloomLevel) {
      return false;
    }

    if (query.tag) {
      const tag = query.tag.trim().toLowerCase();
      if (!(item.tags ?? []).some((value) => value.toLowerCase() === tag)) {
        return false;
      }
    }

    return true;
  });
}

function sortMockSeeds(
  seeds: MockBankSeed[],
  sort: QuestionBankSort,
): MockBankSeed[] {
  const sorted = [...seeds];

  if (sort === "oldest") {
    return sorted.sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) || left.id - right.id,
    );
  }

  if (sort === "popular") {
    return sorted.sort(
      (left, right) => right.usage_count - left.usage_count || right.id - left.id,
    );
  }

  if (sort === "rating") {
    return sorted.sort((left, right) => {
      const leftStats = getMockRatingStats(left.id);
      const rightStats = getMockRatingStats(right.id);
      return (
        rightStats.average - leftStats.average ||
        rightStats.count - leftStats.count ||
        right.usage_count - left.usage_count ||
        right.id - left.id
      );
    });
  }

  if (sort === "content_az") {
    return sorted.sort(
      (left, right) =>
        left.content.toLowerCase().localeCompare(right.content.toLowerCase()) ||
        left.id - right.id,
    );
  }

  return sorted.sort(
    (left, right) =>
      right.created_at.localeCompare(left.created_at) || right.id - left.id,
  );
}

function toQueryString(query: QuestionBankQuery): string {
  const params = new URLSearchParams();

  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.categoryId) params.set("category_id", query.categoryId);
  if (query.questionType) params.set("question_type", query.questionType);
  if (query.bloomLevel) params.set("bloom_level", query.bloomLevel);
  if (query.tag?.trim()) params.set("tag", query.tag.trim());
  if (query.onlyMineUserId) params.set("created_by", `${query.onlyMineUserId}`);
  if (query.includeInactive) params.set("include_inactive", "true");
  if (query.viewerId) params.set("viewer_id", `${query.viewerId}`);
  params.set("sort", query.sort ?? "newest");
  params.set("page", `${query.page ?? 1}`);
  params.set("page_size", `${query.pageSize ?? 12}`);

  return params.toString();
}

// ── Public API ──────────────────────────────────────────

export async function getQuestionBankPage(
  query: QuestionBankQuery = {},
): Promise<QuestionBankPage> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(query.pageSize ?? 12, 100));
    const sort = query.sort ?? "newest";
    const visible = sortMockSeeds(getMockVisibleSeeds(query), sort);
    const total = visible.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;

    return Promise.resolve({
      items: visible
        .slice(start, start + pageSize)
        .map((seed) => buildMockItem(seed, query.viewerId)),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      sort,
    });
  }

  return getJsonOrFallback<QuestionBankPage>(`${endpoints.list}?${toQueryString(query)}`, {
    items: [],
    total: 0,
    page: query.page ?? 1,
    page_size: query.pageSize ?? 12,
    total_pages: 0,
    sort: query.sort ?? "newest",
  });
}

/** Lấy danh sách câu hỏi đang hiển thị (tối đa 100 câu) cho các hộp chọn nhanh. */
export async function getQuestionBankList(
  viewerId?: number,
): Promise<QuestionBankItem[]> {
  const [publicPage, ownPage] = await Promise.all([
    getQuestionBankPage({
      page: 1,
      pageSize: 100,
      viewerId,
      // Kèm câu đang ẩn của chính người xem để họ vẫn dùng được trong bài kiểm tra.
      includeInactive: Boolean(viewerId),
      sort: "newest",
    }),
    viewerId
      ? getQuestionBankPage({
          page: 1,
          pageSize: 100,
          viewerId,
          includeInactive: true,
          onlyMineUserId: viewerId,
          sort: "newest",
        })
      : Promise.resolve(null),
  ]);

  // Gộp thêm câu của chính người xem để câu ẩn không bị rơi ra ngoài 100 câu
  // mới nhất của ngân hàng chung.
  const items = [...publicPage.items];
  for (const item of ownPage?.items ?? []) {
    if (!items.some((entry) => entry.id === item.id)) {
      items.push(item);
    }
  }
  return items;
}

export async function getQuestionBankTags(): Promise<QuestionBankTagSummary[]> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const counts = new Map<string, number>();
    for (const item of mockQuestionBank) {
      if (!item.is_active) {
        continue;
      }
      for (const tag of item.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Promise.resolve(
      [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
        .slice(0, 50),
    );
  }

  return getJsonOrFallback<QuestionBankTagSummary[]>(endpoints.tags, []);
}

export async function getQuestionBankQuestion(
  bankId: number,
  viewerId?: number,
): Promise<QuestionBankItem | null> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const seed = mockQuestionBank.find((entry) => entry.id === bankId);
    return Promise.resolve(seed ? buildMockItem(seed, viewerId) : null);
  }

  const suffix = viewerId ? `?viewer_id=${viewerId}` : "";
  return getJsonOrFallback<QuestionBankItem | null>(
    `${endpoints.detail(bankId)}${suffix}`,
    null,
  );
}

export async function createQuestionBankQuestion(
  draft: QuestionBankDraft,
  createdBy: number,
): Promise<QuestionBankItem> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const nextId = mockQuestionBank.length
      ? Math.max(...mockQuestionBank.map((item) => item.id)) + 1
      : 1;
    const correctOptions = draft.options.filter(
      (option) => option.content.trim() !== "" && option.is_correct,
    );
    const created: MockBankSeed = {
      id: nextId,
      content: draft.content.trim(),
      question_type: draft.question_type,
      answer:
        draft.question_type === "fill_in_blank"
          ? draft.answer.trim()
          : correctOptions.map((option) => option.content.trim()).join(" | "),
      bloom_level: draft.bloom_level,
      score: draft.score,
      category_id: draft.category_id,
      category_name: draft.category_id
        ? mockCategoryNames[draft.category_id] ?? null
        : null,
      created_by: createdBy,
      created_by_name: "Nguyễn Thiên Long",
      is_active: draft.is_active,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: normalizeQuestionBankTags(draft.tags),
      options:
        draft.question_type === "fill_in_blank"
          ? []
          : draft.options
              .filter((option) => option.content.trim() !== "")
              .map((option, index) => ({
                id: nextId * 100 + index,
                content: option.content.trim(),
                is_correct: option.is_correct,
              })),
    };
    mockQuestionBank = [...mockQuestionBank, created];
    return Promise.resolve(buildMockItem(created, createdBy));
  }

  return sendJson<QuestionBankItem>(endpoints.create, "POST", {
    content: draft.content.trim(),
    question_type: draft.question_type,
    answer: draft.answer.trim(),
    bloom_level: draft.bloom_level,
    score: draft.score,
    category_id: draft.category_id,
    is_active: draft.is_active,
    tags: normalizeQuestionBankTags(draft.tags),
    created_by: createdBy,
    options:
      draft.question_type === "fill_in_blank"
        ? []
        : draft.options
            .filter((option) => option.content.trim() !== "")
            .map((option) => ({
              content: option.content.trim(),
              is_correct: option.is_correct,
            })),
  });
}

export async function updateQuestionBankQuestion(
  bankId: number,
  draft: QuestionBankDraft,
  userId: number,
): Promise<QuestionBankItem> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const index = mockQuestionBank.findIndex((item) => item.id === bankId);
    if (index === -1) {
      throw new Error("Không tìm thấy câu hỏi trong ngân hàng chung.");
    }
    const correctOptions = draft.options.filter(
      (option) => option.content.trim() !== "" && option.is_correct,
    );
    const updated: MockBankSeed = {
      ...mockQuestionBank[index],
      content: draft.content.trim(),
      question_type: draft.question_type,
      answer:
        draft.question_type === "fill_in_blank"
          ? draft.answer.trim()
          : correctOptions.map((option) => option.content.trim()).join(" | "),
      bloom_level: draft.bloom_level,
      score: draft.score,
      category_id: draft.category_id,
      category_name: draft.category_id
        ? mockCategoryNames[draft.category_id] ?? null
        : null,
      is_active: draft.is_active,
      tags: normalizeQuestionBankTags(draft.tags),
      updated_at: new Date().toISOString(),
      options:
        draft.question_type === "fill_in_blank"
          ? []
          : draft.options
              .filter((option) => option.content.trim() !== "")
              .map((option, optionIndex) => ({
                id: bankId * 100 + optionIndex,
                content: option.content.trim(),
                is_correct: option.is_correct,
              })),
    };
    mockQuestionBank[index] = updated;
    return Promise.resolve(buildMockItem(updated, userId));
  }

  return sendJson<QuestionBankItem>(endpoints.update(bankId, userId), "PUT", {
    content: draft.content.trim(),
    question_type: draft.question_type,
    answer: draft.answer.trim(),
    bloom_level: draft.bloom_level,
    score: draft.score,
    category_id: draft.category_id,
    is_active: draft.is_active,
    tags: normalizeQuestionBankTags(draft.tags),
    options:
      draft.question_type === "fill_in_blank"
        ? []
        : draft.options
            .filter((option) => option.content.trim() !== "")
            .map((option) => ({
              content: option.content.trim(),
              is_correct: option.is_correct,
            })),
  });
}

export async function deleteQuestionBankQuestion(
  bankId: number,
  userId: number,
): Promise<void> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    mockQuestionBank = mockQuestionBank.filter((item) => item.id !== bankId);
    mockRatings = Object.fromEntries(
      Object.entries(mockRatings).map(([ratingUserId, byBank]) => {
        const nextByBank = { ...byBank };
        delete nextByBank[bankId];
        return [ratingUserId, nextByBank];
      }),
    );
    return Promise.resolve();
  }

  const response = await fetch(endpoints.remove(bankId, userId), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

/** Đánh giá chất lượng câu hỏi (1-5 sao). Đánh giá lại sẽ cập nhật. */
export async function rateQuestionBankQuestion(
  bankId: number,
  userId: number,
  rating: number,
): Promise<QuestionBankItem> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Điểm đánh giá phải nằm trong khoảng 1-5 sao.");
  }

  if (USE_MOCK_QUESTION_BANK_DATA) {
    const seed = mockQuestionBank.find((item) => item.id === bankId);
    if (!seed) {
      throw new Error("Không tìm thấy câu hỏi trong ngân hàng chung.");
    }
    mockRatings = {
      ...mockRatings,
      [userId]: { ...(mockRatings[userId] ?? {}), [bankId]: rating },
    };
    return Promise.resolve(buildMockItem(seed, userId));
  }

  return sendJson<QuestionBankItem>(endpoints.rating(bankId), "PUT", {
    user_id: userId,
    rating,
  });
}

/** Bỏ đánh giá của giảng viên cho câu hỏi. */
export async function removeQuestionBankRating(
  bankId: number,
  userId: number,
): Promise<QuestionBankItem> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const seed = mockQuestionBank.find((item) => item.id === bankId);
    if (!seed) {
      throw new Error("Không tìm thấy câu hỏi trong ngân hàng chung.");
    }
    const byBank = { ...(mockRatings[userId] ?? {}) };
    delete byBank[bankId];
    mockRatings = { ...mockRatings, [userId]: byBank };
    return Promise.resolve(buildMockItem(seed, userId));
  }

  const response = await fetch(
    `${endpoints.rating(bankId)}?user_id=${userId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as QuestionBankItem;
}

export async function publishQuestionToBank(
  input: PublishQuestionInput,
): Promise<QuestionBankItem> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const preview = input.preview;
    if (!preview) {
      throw new Error("Không có dữ liệu câu hỏi để đăng lên ngân hàng chung.");
    }

    const existing = mockQuestionBank.find(
      (item) =>
        item.created_by === input.createdBy &&
        item.content === preview.question.content &&
        item.is_active,
    );
    if (existing) {
      return Promise.resolve(buildMockItem(existing, input.createdBy));
    }

    const nextId = mockQuestionBank.length
      ? Math.max(...mockQuestionBank.map((item) => item.id)) + 1
      : 1;
    const created: MockBankSeed = {
      id: nextId,
      content: preview.question.content,
      question_type: preview.question.question_type,
      answer: preview.question.answer,
      bloom_level: preview.question.bloom_level ?? "remember",
      score: input.score ?? preview.question.score ?? 1,
      category_id: input.categoryId ?? null,
      category_name: input.categoryId
        ? mockCategoryNames[input.categoryId] ?? null
        : null,
      created_by: input.createdBy,
      created_by_name: "Nguyễn Thiên Long",
      is_active: true,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: normalizeQuestionBankTags(input.tags ?? []),
      options: (preview.options ?? []).map((option, index) => ({
        id: nextId * 100 + index,
        content: option.content,
        is_correct: option.is_correct,
      })),
    };
    mockQuestionBank = [...mockQuestionBank, created];
    return Promise.resolve(buildMockItem(created, input.createdBy));
  }

  return sendJson<QuestionBankItem>(endpoints.publish, "POST", {
    question_id: input.questionId,
    created_by: input.createdBy,
    category_id: input.categoryId ?? null,
    score: input.score,
    tags: normalizeQuestionBankTags(input.tags ?? []),
  });
}

export async function importQuestionsFromBank(input: {
  examId: number;
  questionIds: number[];
  /** Người thêm câu hỏi; câu đang ẩn của chính người này vẫn dùng được. */
  userId?: number;
}): Promise<QuestionBankImportResult> {
  if (USE_MOCK_QUESTION_BANK_DATA) {
    const canUse = (item: MockBankSeed) =>
      item.is_active ||
      (input.userId !== undefined && item.created_by === input.userId);
    const validIds = input.questionIds.filter((bankId) =>
      mockQuestionBank.some((item) => item.id === bankId && canUse(item)),
    );
    mockQuestionBank = mockQuestionBank.map((item) =>
      validIds.includes(item.id)
        ? { ...item, usage_count: item.usage_count + 1 }
        : item,
    );
    return Promise.resolve({
      exam_id: input.examId,
      imported: validIds.length,
      skipped: input.questionIds.length - validIds.length,
      question_ids: validIds,
    });
  }

  return sendJson<QuestionBankImportResult>(endpoints.import, "POST", {
    exam_id: input.examId,
    question_ids: input.questionIds,
    user_id: input.userId,
  });
}
