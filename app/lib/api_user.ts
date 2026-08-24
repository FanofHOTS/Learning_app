
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_USER_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type User = {
    id: number
    username: string
    email: string
    icon: string
    role: string
    is_password_reset?: boolean
}

type FastApiError = {
  detail?: string;
};

const endpoints = {
  userList: () => `${API_BASE_URL}/user`,
  currentUser: () => `${API_BASE_URL}/user/me`
}

const mockUsers: User[] = [
    {
    id: 1,
    username: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    icon: "/icon.png",
    role: "student",
    },
    {
    id: 2,
    username: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    icon: "/icon.png",
    role: "admin", 
    },
    {
    id: 3,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
    {
    id: 4,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
    {
    id: 5,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
    {
    id: 6,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
    {
    id: 7,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
]

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export async function getUserList(): Promise<User[]>{
  if (USE_MOCK_USER_DATA) {
    return Promise.resolve(mockUsers);
  }

  try {
    return await getJson<User[]>(endpoints.userList());
  } catch {
    return [];
  }
}
