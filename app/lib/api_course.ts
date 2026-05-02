import type { User } from "./api_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_COURSE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type FastAPICourse = {
    id: number
    title: string
    category_id: number
    instructor_id: number
    introduction: string
    description: string
    level: string
    total_module: number
    total_student: number
    image: string
    is_active: boolean
    is_public: boolean
}

// Lấy tên của phân loại và giảng viên thay vì id của 2 yếu tố đó
export type Course = {
    id: number
    title: string
    category_name: string
    instructor_name: string
    introduction: string
    description: string
    level: string
    total_module: number
    total_student: number
    image: string
    is_active: boolean
    is_public: boolean
}

type FastApiError = {
  detail?: string;
};

const endpoints = {
  courseList: () => `${API_BASE_URL}/course/`,
  //instructorById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  //categoryById: (categoryId: number) => `${API_BASE_URL}/category/${categoryId}`,
  categoryList: () => `${API_BASE_URL}/category/`,
  //instructorList: () => `${API_BASE_URL}/user/instructor`,
  userList: () => `${API_BASE_URL}/user/`,
};

const mockCourseFastAPI: FastAPICourse[] = [
  {id: 1,
  title: "Nền tảng xây dựng ứng dụng học tập với AI",
  category_id: 1,
  instructor_id: 2,
  introduction: "Khóa học giúp học sinh học trực tuyến theo module và thành phần.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 3,
  total_student: 42,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 2,
  title: "Lập trình cơ bản",
  category_id: 2,
  instructor_id: 7,
  introduction: "Khóa học sẽ dạy về những loại lệnh cơ bản trong lập trình qua C++.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 6,
  total_student: 123,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 3,
  title: "Cơ sở toán trong CNTT",
  category_id: 3,
  instructor_id: 3,
  introduction: "Khóa học sẽ dạy về những kiến thức toán được ứng dụng rộng rãi trong CNTT.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 125,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 4,
  title: "Toán rời rạc",
  category_id: 3,
  instructor_id: 4,
  introduction: "Khóa học sẽ dạy về những thuật toán được ứng dụng nhiều trong CNTT.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 5,
  total_student: 115,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 5,
  title: "Sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm",
  category_id: 1,
  instructor_id: 2,
  introduction: "Khóa học giúp học sinh sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm trên trang web.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 3,
  total_student: 35,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 6,
  title: "Lập trình bằng Python",
  category_id: 2,
  instructor_id: 5,
  introduction: "Khóa học sẽ hướng dẫn việc lập trình cơ bản qua ngôn ngữ Python.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 122,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 7,
  title: "Cơ sở dữ liệu",
  category_id: 4,
  instructor_id: 6,
  introduction: "Khóa học sẽ dạy về cơ sở dữ liệu và những khái niệm liên quan, cũng như là cách sử dụng SQL Server ở mức cơ bản.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 102,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 8,
  title: "Lập trình hướng đối tượng",
  category_id: 2,
  instructor_id: 7,
  introduction: "Khóa học sẽ dạy về lập trình hướng đối tượng và những khái niệm liên quan thông qua C++.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 113,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
];

const mockCourse: Course[] = [
  {id: 1,
  title: "Nền tảng xây dựng ứng dụng học tập với AI",
  category_name: "Hướng dẫn sử dụng trang web",
  instructor_name: "Võ Thiên Sơn",
  introduction: "Khóa học giúp học sinh học trực tuyến theo module và thành phần.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 3,
  total_student: 42,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 2,
  title: "Lập trình cơ bản",
  category_name: "Lập trình",
  instructor_name: "Nguyễn Thiên Long",
  introduction: "Khóa học sẽ dạy về những loại lệnh cơ bản trong lập trình qua C++.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 6,
  total_student: 123,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 3,
  title: "Cơ sở toán trong CNTT",
  category_name: "Toán học",
  instructor_name: "Trần Thị Ngọc Sanh",
  introduction: "Khóa học sẽ dạy về những kiến thức toán được ứng dụng rộng rãi trong CNTT.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 125,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 4,
  title: "Toán rời rạc",
  category_name: "Toán học",
  instructor_name: "Nguyễn Thị Văn Sơn",
  introduction: "Khóa học sẽ dạy về những thuật toán được ứng dụng nhiều trong CNTT.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 5,
  total_student: 115,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 5,
  title: "Sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm",
  category_name: "Hướng dẫn sử dụng trang web",
  instructor_name: "Võ Thiên Sơn",
  introduction: "Khóa học giúp học sinh sử dụng công cụ AI tự động tạo câu hỏi trắc nghiệm trên trang web.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 3,
  total_student: 35,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 6,
  title: "Lập trình bằng Python",
  category_name: "Lập trình",
  instructor_name: "Võ Thăng Tiến",
  introduction: "Khóa học sẽ hướng dẫn việc lập trình cơ bản qua ngôn ngữ Python.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 122,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 7,
  title: "Cơ sở dữ liệu",
  category_name: "Dữ liệu",
  instructor_name: "Trần Thị Ngọc Nhung",
  introduction: "Khóa học sẽ dạy về cơ sở dữ liệu và những khái niệm liên quan, cũng như là cách sử dụng SQL Server ở mức cơ bản.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 102,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
  {id: 8,
  title: "Lập trình hướng đối tượng",
  category_name: "Lập trình",
  instructor_name: "Nguyễn Thiên Long",
  introduction: "Khóa học sẽ dạy về lập trình hướng đối tượng và những khái niệm liên quan thông qua C++.",
  description:
    "Bạn sẽ đi qua từng module, học tài liệu trước rồi mới mở được bài kiểm tra kế tiếp.",
  level: "Cơ bản",
  total_module: 7,
  total_student: 113,
  image: "/logo.png",
  is_active: true,
  is_public: true,
  },
];

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

export async function getCourseListFastAPI(): Promise<FastAPICourse[]> {
  if (USE_MOCK_COURSE_DATA) {
    return Promise.resolve(mockCourseFastAPI)
  }
    const course = await Promise.resolve(getJson<FastAPICourse[]>(endpoints.courseList()))
  return course
}

export async function getCourseList(): Promise<Course[]> {
  if (USE_MOCK_COURSE_DATA) {
    return Promise.resolve(mockCourse)
  }
    const course = await Promise.resolve(getJson<Course[]>(endpoints.courseList()))
  return course
}