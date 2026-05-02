const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_USER_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_STUDENT_DASHBOARD !== "false";

export type User = {
    id: number
    username: string
    email: string
    icon: string
    role: string
}

const endpoints = `${API_BASE_URL}/user/me`

const mockUser: User[] = [
    {
    id: 1,
    username: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    icon: "/icon.png",
    role: "student",
    },
    {
    id: 7,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
    {
    id: 2,
    username: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    icon: "/icon.png",
    role: "admin", 
    }
]

