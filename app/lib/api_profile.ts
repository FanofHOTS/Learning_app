import type { User } from "./api_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_PROFILE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type UserProfile = {
  user_id: number;
  name: string;
  email: string;
  location: string;
  organization: string;
  description: string;
  specialization: string;
};

export type ProfilePageData = {
  user: User;
  profile: UserProfile;
};

export type ProfileUpdateInput = {
  name: string;
  email: string;
  location: string;
  organization: string;
  description: string;
  specialization: string;
};

export type UserProfileUpdateInput = {
  username: string;
  icon: string;
};

export type UploadProfileIconResponse = {
  file_url: string;
};

export type DeleteOldUploadResponse = {
  message: string;
};

type FastApiError = {
  detail?: string;
};

type FastApiUserUpdatePayload = {
  username?: string;
  icon?: string;
};

const endpoints = {
  userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  updateUser: (userId: number) => `${API_BASE_URL}/user/update/${userId}`,
  profileByUserId: (userId: number) => `${API_BASE_URL}/profile/${userId}`,
  updateProfile: (userId: number) => `${API_BASE_URL}/profile/update/${userId}`,
  uploadIcon: () => `${API_BASE_URL}/document/upload`,
  deleteOldUpload: (fileUrl: string) =>
    `${API_BASE_URL}/document/delete_upload?file_url=${encodeURIComponent(fileUrl)}`,
};

const mockUsers: User[] = [
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
  },
];

const mockProfiles: UserProfile[] = [
  {
    user_id: 1,
    name: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    location: "Thành phố Hồ Chí Minh",
    organization: "Đại học Công nghệ Thông tin",
    description: "Yêu thích AI, phát triển web và học theo dự án thực tế.",
    specialization: "Học sinh công nghệ thông tin",
  },
  {
    user_id: 7,
    name: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    location: "Thành phố Hồ Chí Minh",
    organization: "Đại học Công nghệ Thông tin",
    description:
      "Giảng viên tập trung vào các chủ đề AI ứng dụng, phát triển web và trải nghiệm học tập số.",
    specialization: "AI, Machine Learning, Python",
  },
  {
    user_id: 2,
    name: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    location: "Thành phố Hồ Chí Minh",
    organization: "Trung tâm điều hành hệ thống",
    description: "Phụ trách quản trị nền tảng và giám sát hoạt động hệ thống.",
    specialization: "Quản trị hệ thống",
  },
];

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
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

function getExtension(fileNameOrUrl: string): string {
  const normalized = fileNameOrUrl.toLowerCase().split("?")[0];
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return normalized.slice(lastDot);
}

export function validateProfileIconFile(fileNameOrUrl: string): string | null {
  const extension = getExtension(fileNameOrUrl);
  if (!extension) {
    return "Không xác định được định dạng của hình tải lên.";
  }

  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return "Icon tài khoản chỉ chấp nhận tệp .png, .jpg, .jpeg hoặc .webp.";
  }

  return null;
}

export function shouldDeleteUploadedProfileIcon(fileUrl: string): boolean {
  return fileUrl.startsWith("/uploads/");
}

export function validateProfileUpdate(payload: ProfileUpdateInput): string {
  if (!payload.name.trim()) {
    return "Họ và tên không được để trống.";
  }

  if (!payload.location.trim()) {
    return "Địa điểm không được để trống.";
  }

  if (!payload.organization.trim()) {
    return "Tổ chức không được để trống.";
  }

  if (!payload.description.trim()) {
    return "Mô tả hồ sơ không được để trống.";
  }

  //if (!payload.specialization.trim()) {
  //  return "Chuyên môn không được để trống.";
  //}

  return "";
}

export async function getProfilePageData(userId: number): Promise<ProfilePageData> {
  if (USE_MOCK_PROFILE_DATA) {
    const user = mockUsers.find((item) => item.id === userId) ?? mockUsers[1];
    const profile =
      mockProfiles.find((item) => item.user_id === userId) ?? mockProfiles[1];

    return Promise.resolve({
      user: { ...user },
      profile: { ...profile, user_id: user.id },
    });
  }

  const [user, profile] = await Promise.all([
    getJson<User>(endpoints.userById(userId)),
    getJson<UserProfile>(endpoints.profileByUserId(userId)),
  ]);

  return {
    user,
    profile,
  };
}

export async function updateProfileRecord(
  userId: number,
  payload: ProfileUpdateInput,
): Promise<UserProfile> {
  if (USE_MOCK_PROFILE_DATA) {
    const profileIndex = mockProfiles.findIndex((item) => item.user_id === userId);
    if (profileIndex === -1) {
      throw new Error("Không tìm thấy hồ sơ để cập nhật.");
    }

    mockProfiles[profileIndex] = {
      ...mockProfiles[profileIndex],
      ...payload,
      user_id: userId,
    };

    return Promise.resolve({ ...mockProfiles[profileIndex] });
  }

  return putJson<UserProfile>(endpoints.updateProfile(userId), {
    user_id: userId,
    ...payload,
  });
}

export async function updateProfileUserAccount(
  userId: number,
  payload: UserProfileUpdateInput,
): Promise<User> {
  if (USE_MOCK_PROFILE_DATA) {
    const userIndex = mockUsers.findIndex((item) => item.id === userId);
    if (userIndex === -1) {
      throw new Error("Không tìm thấy tài khoản để cập nhật.");
    }

    mockUsers[userIndex] = {
      ...mockUsers[userIndex],
      username: payload.username,
      icon: payload.icon,
    };

    const profileIndex = mockProfiles.findIndex((item) => item.user_id === userId);
    if (profileIndex >= 0) {
      mockProfiles[profileIndex] = {
        ...mockProfiles[profileIndex],
        name: payload.username,
      };
    }

    return Promise.resolve({ ...mockUsers[userIndex] });
  }

  const userPayload: FastApiUserUpdatePayload = {
    username: payload.username,
    icon: payload.icon,
  };

  return putJson<User>(endpoints.updateUser(userId), userPayload);
}

export async function uploadProfileIcon(
  file: File,
): Promise<UploadProfileIconResponse> {
  const validationMessage = validateProfileIconFile(file.name);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  if (USE_MOCK_PROFILE_DATA) {
    return Promise.resolve({
      file_url: `/uploads/${Date.now()}-${file.name}`,
    });
  }

  const form = new FormData();
  form.append("file", file);
  form.append("document_type", "other");

  return fetchJson<UploadProfileIconResponse>(endpoints.uploadIcon(), {
    method: "POST",
    body: form,
  });
}

export async function deleteOldProfileIcon(
  fileUrl: string,
): Promise<DeleteOldUploadResponse> {
  if (USE_MOCK_PROFILE_DATA) {
    return Promise.resolve({
      message: "Icon cũ đã được xóa thành công.",
    });
  }

  return fetchJson<DeleteOldUploadResponse>(endpoints.deleteOldUpload(fileUrl), {
    method: "POST",
  });
}
