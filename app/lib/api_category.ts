const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_CATEGORY_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type Category = {
  id: number;
  name: string;
  description: string;
}

const endpoints = {
  categoryList: () => `${API_BASE_URL}/category`,
  createCategory: () => `${API_BASE_URL}/category/create`,
  updateCategory: (category_id: Number) => `${API_BASE_URL}/update/${category_id}`
};

const mockCategories: Category[] = [
    {
        id: 1,
        name: "Hướng dẫn sử dụng trang web",
        description: "Đây là phân loại liên quan tới việc hướng dẫn sử dụng trang web"
    },
    {
        id: 2,
        name: "Lập trình",
        description: "Đây là phân loại liên quan tới lập trình"
    },
    {
        id: 3,
        name: "Toán học",
        description: "Đây là phân loại liên quan tới toán học"
    },
    {
        id: 4,
        name: "Dữ liệu",
        description: "Đây là phân loại liên quan tới dữ liệu"
    }
]


async function parseError(response: Response): Promise<Error> {
  let errorDetail = "Lỗi kết nối đến máy chủ.";
  try {
    const json = await response.json();
    if (json?.detail) {
      errorDetail = json.detail;
    }
  } catch {
    // ignore parse errors
  }
  return new Error(errorDetail);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

export async function getCategoryList(): Promise<Category[]> {
  if (USE_MOCK_CATEGORY_DATA){
    return Promise.resolve(mockCategories)
  }  
  return fetchJson<Category[]>(endpoints.categoryList());
}

export async function createCategory(
  category: Omit<Category, "id">,
): Promise<Category> {
  if (USE_MOCK_CATEGORY_DATA) {
    const nextId = mockCategories.length
      ? Math.max(...mockCategories.map((category) => category.id)) + 1
      : 1;
    const newCategory: Category = {
      id: nextId,
      ...category,
    };
    mockCategories.push(newCategory);
    return Promise.resolve(newCategory);
  }

  return fetchJson<Category>(endpoints.createCategory(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(category),
  });
}

export async function updateCategory(
  categoryId: number,
  category: Partial<Omit<Category, "id">>,
): Promise<Category> {
  if (USE_MOCK_CATEGORY_DATA) {
    const index = mockCategories.findIndex((item) => item.id === categoryId);
    if (index === -1) {
      throw new Error("Phân loại không tồn tại.");
    }
    mockCategories[index] = {
      ...mockCategories[index],
      ...category,
    };
    return Promise.resolve(mockCategories[index]);
  }

  return fetchJson<Category>(endpoints.updateCategory(categoryId), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(category),
  });
}

export function filterCategory(
  categories: Category[],
  filter: string,
): Category[] {
  const keyword = filter.trim().toLowerCase();

  return categories.filter((category) => {
    const matchesKeyword =
      keyword.length === 0 ||
      category.name.toLowerCase().includes(keyword) ||
      category.description.toLowerCase().includes(keyword);

    return matchesKeyword;
  });
}

export function validateCategoryUpdate(
  category: Omit<Category, "id">,
): string {
  
  if (!category.name.trim()) {
    return "Tên phân loại không được để trống.";
  }

  if (!category.description.trim()) {
    return "Mô tả phân loại không được để trống.";
  }

  return "";
}

