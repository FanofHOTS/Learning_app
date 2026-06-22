const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_CERTIFICATE_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type Certificate = {
  id: number;
  user_id: number;
  course_id: number;
  issued_at: string;
  certificate_code: string;
  certificate_file: string | null;
  template_id: number | null;
  student_name: string | null;
  course_title: string | null;
};

export type CertificateReissueResponse = {
  certificate: Certificate;
  created: boolean;
  message: string;
};

export type CertificateTemplate = {
  id: number;
  name: string;
  description: string | null;
  file_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CertificateTemplateCreate = {
  name: string;
  description?: string | null;
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  certificatesByUser: (userId: number) =>
    `${API_BASE_URL}/certificate/user/${userId}`,
  certificatesByCourse: (courseId: number) =>
    `${API_BASE_URL}/certificate/course/${courseId}`,
  verifyCertificate: (code: string) =>
    `${API_BASE_URL}/certificate/verify/${encodeURIComponent(code)}`,
  certificateByCourseAndUser: (courseId: number, userId: number) =>
    `${API_BASE_URL}/certificate/${courseId}/${userId}`,
  issueCertificate: (courseId: number, userId: number) =>
    `${API_BASE_URL}/certificate/issue/${courseId}/${userId}`,
  reissueCertificate: (courseId: number, userId: number) =>
    `${API_BASE_URL}/certificate/reissue/${courseId}/${userId}`,
  allCertificates: () => `${API_BASE_URL}/certificate/`,
  // Template management
  allTemplates: () => `${API_BASE_URL}/certificate/template/`,
  activeTemplate: () => `${API_BASE_URL}/certificate/template/active`,
  templateById: (templateId: number) =>
    `${API_BASE_URL}/certificate/template/${templateId}`,
  createTemplate: () => `${API_BASE_URL}/certificate/template/create`,
  uploadTemplateFile: (templateId: number) =>
    `${API_BASE_URL}/certificate/template/${templateId}/upload`,
  activateTemplate: (templateId: number) =>
    `${API_BASE_URL}/certificate/template/${templateId}/activate`,
  deactivateTemplate: (templateId: number) =>
    `${API_BASE_URL}/certificate/template/${templateId}/deactivate`,
  updateTemplate: (templateId: number) =>
    `${API_BASE_URL}/certificate/template/update/${templateId}`,
  deleteTemplate: (templateId: number) =>
    `${API_BASE_URL}/certificate/template/delete/${templateId}`,
};

const mockCertificates: Certificate[] = [
  {
    id: 1,
    user_id: 1,
    course_id: 101,
    issued_at: "2026-04-20T08:00:00Z",
    certificate_code: "CERT-20260420-101-1-A3F8C2",
    certificate_file: "/uploads/certificates/CERT-20260420-101-1-A3F8C2.png",
    template_id: null,
    student_name: "Nguyễn Văn An",
    course_title: "Python căn bản cho người mới bắt đầu",
  },
  {
    id: 2,
    user_id: 1,
    course_id: 103,
    issued_at: "2026-05-02T08:00:00Z",
    certificate_code: "CERT-20260502-103-1-B7D91E",
    certificate_file: "/uploads/certificates/CERT-20260502-103-1-B7D91E.png",
    template_id: null,
    student_name: "Nguyễn Văn An",
    course_title: "Cơ sở dữ liệu SQL thực hành",
  },
  {
    id: 3,
    user_id: 2,
    course_id: 102,
    issued_at: "2026-05-15T08:00:00Z",
    certificate_code: "CERT-20260515-102-2-E5C7A1",
    certificate_file: "/uploads/certificates/CERT-20260515-102-2-E5C7A1.png",
    template_id: null,
    student_name: "Trần Thị Bình",
    course_title: "Phát triển giao diện với Next.js",
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

async function getJsonOrFallback<T>(url: string, fallbackValue: T): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return fallbackValue;
  }

  return (await response.json()) as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function putJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function delJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function uploadFile<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

function filterCertificatesByUser(
  certificates: Certificate[],
  userId: number,
): Certificate[] {
  return certificates.filter((cert) => cert.user_id === userId);
}

function filterCertificatesByCourse(
  certificates: Certificate[],
  courseId: number,
): Certificate[] {
  return certificates.filter((cert) => cert.course_id === courseId);
}

/**
 * Lấy danh sách chứng chỉ của một học viên.
 * Endpoint: GET /certificate/user/{user_id}
 */
export async function getCertificatesByUser(
  userId: number,
): Promise<Certificate[]> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    return Promise.resolve(filterCertificatesByUser(mockCertificates, userId));
  }

  return getJson<Certificate[]>(endpoints.certificatesByUser(userId));
}

/**
 * Lấy danh sách chứng chỉ của một khóa học.
 * Endpoint: GET /certificate/course/{course_id}
 */
export async function getCertificatesByCourse(
  courseId: number,
): Promise<Certificate[]> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    return Promise.resolve(
      filterCertificatesByCourse(mockCertificates, courseId),
    );
  }

  return getJson<Certificate[]>(endpoints.certificatesByCourse(courseId));
}

/**
 * Xác minh chứng chỉ bằng mã chứng chỉ.
 * Endpoint: GET /certificate/verify/{certificate_code}
 */
export async function verifyCertificate(
  certificateCode: string,
): Promise<Certificate | null> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const certificate = mockCertificates.find(
      (cert) => cert.certificate_code === certificateCode,
    );
    return Promise.resolve(certificate ?? null);
  }

  return getJsonOrFallback<Certificate | null>(
    endpoints.verifyCertificate(certificateCode),
    null,
  );
}

/**
 * Lấy chứng chỉ của một học viên trong một khóa học cụ thể.
 * Endpoint: GET /certificate/{course_id}/{user_id}
 */
export async function getCertificateByCourseAndUser(
  courseId: number,
  userId: number,
): Promise<Certificate | null> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const certificate = mockCertificates.find(
      (cert) => cert.course_id === courseId && cert.user_id === userId,
    );
    return Promise.resolve(certificate ?? null);
  }

  return getJsonOrFallback<Certificate | null>(
    endpoints.certificateByCourseAndUser(courseId, userId),
    null,
  );
}

/**
 * Cấp chứng chỉ cho học viên khi hoàn thành khóa học.
 * Endpoint: POST /certificate/issue/{course_id}/{user_id}
 */
export async function issueCertificate(
  courseId: number,
  userId: number,
): Promise<Certificate> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const existing = mockCertificates.find(
      (cert) => cert.course_id === courseId && cert.user_id === userId,
    );
    if (existing) {
      return Promise.resolve(existing);
    }

    const newCertificate: Certificate = {
      id: mockCertificates.length + 1,
      user_id: userId,
      course_id: courseId,
      issued_at: new Date().toISOString(),
      certificate_code: `CERT-MOCK-${courseId}-${userId}-${Date.now().toString(36).toUpperCase()}`,
      certificate_file: null,
      template_id: null,
      student_name: "Nguyễn Văn An",
      course_title: `Khóa học #${courseId}`,
    };
    mockCertificates.push(newCertificate);
    return Promise.resolve(newCertificate);
  }

  return postJson<Certificate>(endpoints.issueCertificate(courseId, userId));
}

/**
 * Cấp lại chứng chỉ (không báo lỗi nếu đã tồn tại).
 * Endpoint: POST /certificate/reissue/{course_id}/{user_id}
 */
export async function reissueCertificate(
  courseId: number,
  userId: number,
): Promise<CertificateReissueResponse> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const existing = mockCertificates.find(
      (cert) => cert.course_id === courseId && cert.user_id === userId,
    );

    if (existing) {
      return Promise.resolve({
        certificate: existing,
        created: false,
        message: "Sinh viên đã có chứng chỉ cho khóa học này",
      });
    }

    const newCertificate: Certificate = {
      id: mockCertificates.length + 1,
      user_id: userId,
      course_id: courseId,
      issued_at: new Date().toISOString(),
      certificate_code: `CERT-MOCK-${courseId}-${userId}-${Date.now().toString(36).toUpperCase()}`,
      certificate_file: null,
      template_id: null,
      student_name: "Nguyễn Văn An",
      course_title: `Khóa học #${courseId}`,
    };
    mockCertificates.push(newCertificate);

    return Promise.resolve({
      certificate: newCertificate,
      created: true,
      message: "Đã cấp chứng chỉ hoàn thành khóa học thành công",
    });
  }

  return postJson<CertificateReissueResponse>(
    endpoints.reissueCertificate(courseId, userId),
  );
}

/**
 * Lấy tất cả chứng chỉ (dành cho admin).
 * Endpoint: GET /certificate/
 */
export async function getAllCertificates(): Promise<Certificate[]> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    return Promise.resolve([...mockCertificates]);
  }

  return getJson<Certificate[]>(endpoints.allCertificates());
}

// ──────────────────────────────────────────────
//  Certificate template API
// ──────────────────────────────────────────────

const mockTemplates: CertificateTemplate[] = [
  {
    id: 1,
    name: "Mẫu chứng chỉ mặc định",
    description: "Mẫu chứng chỉ nền trắng với đường viền xanh, phù hợp cho mọi loại khóa học.",
    file_url: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Mẫu chứng chỉ trang trọng",
    description: "Mẫu chứng chỉ với nền vàng kem và họa tiết cổ điển.",
    file_url: "/uploads/certificate-templates/formal-template.png",
    is_active: false,
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-03-15T00:00:00Z",
  },
  {
    id: 3,
    name: "Mẫu chứng chỉ hiện đại",
    description: "Mẫu chứng chỉ phong cách tối giản với accent màu xanh dương.",
    file_url: "/uploads/certificate-templates/modern-template.png",
    is_active: false,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-20T00:00:00Z",
  },
];

let nextMockTemplateId = 4;

/**
 * Lấy danh sách tất cả mẫu chứng chỉ.
 * Endpoint: GET /certificate/template/
 */
export async function getAllTemplates(): Promise<CertificateTemplate[]> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    return Promise.resolve([...mockTemplates]);
  }

  return getJson<CertificateTemplate[]>(endpoints.allTemplates());
}

/**
 * Lấy mẫu chứng chỉ đang active.
 * Endpoint: GET /certificate/template/active
 */
export async function getActiveTemplate(): Promise<CertificateTemplate | null> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const active = mockTemplates.find((t) => t.is_active);
    return Promise.resolve(active ?? null);
  }

  return getJsonOrFallback<CertificateTemplate | null>(
    endpoints.activeTemplate(),
    null,
  );
}

/**
 * Lấy chi tiết một mẫu chứng chỉ.
 * Endpoint: GET /certificate/template/{template_id}
 */
export async function getTemplateById(
  templateId: number,
): Promise<CertificateTemplate | null> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const template = mockTemplates.find((t) => t.id === templateId);
    return Promise.resolve(template ?? null);
  }

  return getJsonOrFallback<CertificateTemplate | null>(
    endpoints.templateById(templateId),
    null,
  );
}

/**
 * Tạo mẫu chứng chỉ mới.
 * Endpoint: POST /certificate/template/create
 */
export async function createTemplate(
  payload: CertificateTemplateCreate,
): Promise<CertificateTemplate> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const now = new Date().toISOString();
    const newTemplate: CertificateTemplate = {
      id: nextMockTemplateId++,
      name: payload.name,
      description: payload.description ?? null,
      file_url: null,
      is_active: false,
      created_at: now,
      updated_at: now,
    };
    mockTemplates.push(newTemplate);
    return Promise.resolve(newTemplate);
  }

  return postJson<CertificateTemplate>(
    endpoints.createTemplate(),
    payload,
  );
}

/**
 * Upload file mẫu chứng chỉ (ảnh hoặc PDF).
 * Endpoint: POST /certificate/template/{template_id}/upload
 */
export async function uploadTemplateFile(
  templateId: number,
  file: File,
): Promise<{ message: string; template: CertificateTemplate }> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const template = mockTemplates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error("Không tìm thấy mẫu chứng chỉ.");
    }

    const mockFileUrl = `/uploads/certificate-templates/mock-${Date.now()}-${file.name}`;
    template.file_url = mockFileUrl;
    template.updated_at = new Date().toISOString();

    return Promise.resolve({
      message: "Tải lên mẫu chứng chỉ thành công",
      template: { ...template },
    });
  }

  return uploadFile<{ message: string; template: CertificateTemplate }>(
    endpoints.uploadTemplateFile(templateId),
    file,
  );
}

/**
 * Kích hoạt một mẫu chứng chỉ (tự động hủy kích hoạt các mẫu khác).
 * Endpoint: PUT /certificate/template/{template_id}/activate
 */
export async function activateTemplate(
  templateId: number,
): Promise<CertificateTemplate> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const template = mockTemplates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error("Không tìm thấy mẫu chứng chỉ.");
    }

    mockTemplates.forEach((t) => {
      t.is_active = false;
    });
    template.is_active = true;
    template.updated_at = new Date().toISOString();

    return Promise.resolve({ ...template });
  }

  return putJson<CertificateTemplate>(endpoints.activateTemplate(templateId));
}

/**
 * Hủy kích hoạt một mẫu chứng chỉ.
 * Endpoint: PUT /certificate/template/{template_id}/deactivate
 */
export async function deactivateTemplate(
  templateId: number,
): Promise<CertificateTemplate> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const template = mockTemplates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error("Không tìm thấy mẫu chứng chỉ.");
    }

    template.is_active = false;
    template.updated_at = new Date().toISOString();

    return Promise.resolve({ ...template });
  }

  return putJson<CertificateTemplate>(endpoints.deactivateTemplate(templateId));
}

/**
 * Cập nhật thông tin mẫu chứng chỉ (tên, mô tả).
 * Endpoint: PUT /certificate/template/update/{template_id}
 */
export async function updateTemplate(
  templateId: number,
  payload: CertificateTemplateCreate,
): Promise<CertificateTemplate> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const template = mockTemplates.find((t) => t.id === templateId);
    if (!template) {
      throw new Error("Không tìm thấy mẫu chứng chỉ.");
    }

    template.name = payload.name;
    if (payload.description !== undefined) {
      template.description = payload.description ?? null;
    }
    template.updated_at = new Date().toISOString();

    return Promise.resolve({ ...template });
  }

  return putJson<CertificateTemplate>(
    endpoints.updateTemplate(templateId),
    payload,
  );
}

/**
 * Xóa mẫu chứng chỉ.
 * Endpoint: DELETE /certificate/template/delete/{template_id}
 */
export async function deleteTemplate(
  templateId: number,
): Promise<{ message: string }> {
  if (USE_MOCK_CERTIFICATE_DATA) {
    const index = mockTemplates.findIndex((t) => t.id === templateId);
    if (index === -1) {
      throw new Error("Không tìm thấy mẫu chứng chỉ.");
    }

    mockTemplates.splice(index, 1);

    return Promise.resolve({ message: "Xóa mẫu chứng chỉ thành công" });
  }

  return delJson<{ message: string }>(endpoints.deleteTemplate(templateId));
}
