"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileText,
  LoaderCircle,
  PencilLine,
  Save,
  Search,
  Menu,
  X,
} from "lucide-react";

import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import { getCurrentUser } from "../../lib/auth_client";
import { 
  type Category,
  getCategoryList,
  createCategory,
  updateCategory,
  filterCategory
} from "../../lib/api_category";

const initialUser: User = {
  id: 0,
  username: "Quản trị viên",
  email: "quan_tri_vien@example.com",
  icon: "/icon.png",
  role: "admin",
};

type CreateFormState = {
  name: string;
  description: string;
};

type EditFormState = {
  name: string;
  description: string;
};

export default function Home() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [caterogies, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    description: "",
  });
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: "",
    description: "",
  });
  const [isCreate, setIsCreate] = useState<boolean>(false);
  const [isEdit, setIsEdit] = useState<boolean>(false);


  useEffect(() => {
    let isMounted = true;
  
    async function loadCurrentUser() {
      try {
        // const token = <Lấy từ nơi đã lưu token đăng nhập> 
        // const data = await getCurrentUser(token);
        const data = await getCurrentUser("admin");
  
        if (!isMounted) {
          return;
        }
  
        setCurrentUser(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
  
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể lấy thông tin người dùng đang đăng nhập hiện tại.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
  
    loadCurrentUser();
  
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const data = await getCategoryList();
        if (!isMounted) {
          return;
        }
        setCategories(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể lấy thông tin phân loại.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  function handleEdit(category: Category) {
    setSelectedCategory(category);
    setEditForm({
      name: category.name,
      description: category.description,
    });
    setIsEdit(true);
  }

  function handleCreate() {
    setIsCreate(true);
  }

  function handleCloseCreate() {
    setIsCreate(false);
  }
  function handleCloseEdit() {
    setIsEdit(false);
  }

  const filteredCategories = useMemo(
    () => filterCategory(caterogies, filter),
    [caterogies, filter],
  );

  async function handleSave() {
    if (!selectedCategory) return;
    setIsSaving(true);
    try {
      const updatedCategory = await updateCategory(selectedCategory.id, editForm);
      setCategories((prev) =>
        prev.map((category) =>
          category.id === updatedCategory.id ? updatedCategory : category,
        ),
      );
      setEditForm({
        name: "",
        description: "",
      });
      setIsEdit(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật thông tin phân loại.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSave() {
    setIsSaving(true);
    try {
      const newCategory = await createCategory(createForm);
      setCategories((prev) => [...prev, newCategory]);
      setCreateForm({
        name: "",
        description: "",
      });
      setIsCreate(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo phân loại mới.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  function handleFilterChange(value: string) {
    setFilter(value);
  }

  // Tạm thời chưa có lệnh gọi API xóa phân loại

  function updateCreateForm<K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K],
  ) {
    setCreateForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  function updateEditForm<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  }

  const user = currentUser ?? initialUser;

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
            <h1 className="text-lg font-semibold">Quản lý phân loại khóa học</h1>
            <p className="text-sm text-slate-500">
              Xem, lọc và cập nhật phân loại khóa học trên trang web
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "admin" ? "Quản trị viên" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải danh sách phân loại trên trang web...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-sky-100">Quản lý phân loại</p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    Danh sách phân loại trên trang web
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    Trang này đang bám theo FastAPI ở `category.py` với các route lấy
                    danh sách, cập nhật, tải tệp mới và xóa tệp cũ. Hiện tại dữ liệu
                    vẫn dùng giá trị mẫu để mình hoàn thiện giao diện và luồng chỉnh sửa.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Tạo phân loại mới
                  </button>
                </div>
              </div>
            </section>

            {isCreate ? (
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Tạo phân loại mới</h3>
                <form onSubmit={handleCreateSave} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                      Tên phân loại
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={createForm.name}
                      onChange={(e) => updateCreateForm("name", e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                      Mô tả
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={createForm.description}
                      onChange={(e) => updateCreateForm("description", e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    >
                      {isSaving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseCreate}
                      className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-sky-700 border border-sky-700 shadow-sm hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      Đóng
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-4">
                <label className="block">
                  <span className="mb-2 flex items-center gap-4 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    <span className="whitespace-nowrap">Từ khóa</span>
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Tìm kiếm phân loại..."
                  value={filter}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Danh sách phân loại</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Chọn một phân loại để xem trước và chỉnh sửa.
                    </p>
                  </div>
                </div>
                {filteredCategories.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-400" />
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">
                      Không có phân loại phù hợp
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Mình chưa tìm thấy phân loại nào khớp với bộ lọc hiện tại.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`w-full rounded-3xl border p-4 text-left transition-colors ${
                        isEdit && selectedCategory?.id === category.id 
                          ? "border-sky-400 bg-sky-50" 
                          : "border-slate-200 bg-slate-50/60 hover:border-sky-300 hover:bg-sky-50/70"
                        }`}
                        onClick={() => handleEdit(category)}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="mt-3 text-lg font-semibold text-slate-900">
                              {category.name}
                            </h4>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                              {category.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sky-700">
                            <Eye className="h-4 w-4" />
                            <span className="text-sm font-medium">Xem và sửa</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </article>

              {/* Form chỉnh sửa phân loại sẽ được hiển thị ở đây khi người dùng chọn một phân loại từ danh sách */}
              {isEdit && selectedCategory ? (
                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Chỉnh sửa phân loại</h3>
                  <form onSubmit={handleSave} className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                        Tên phân loại
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={editForm.name}
                        onChange={(e) => updateEditForm("name", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                        Mô tả
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={editForm.description}
                        onChange={(e) => updateEditForm("description", e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCloseEdit}
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                      >
                        {isSaving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <PencilLine className="mx-auto h-8 w-8 text-slate-400" />
                  <h4 className="mt-4 text-lg font-semibold text-slate-900">
                    Chưa chọn phân loại nào
                  </h4>
                  <p className="mt-2 text-sm text-slate-600">
                    Mình đã chuẩn bị sẵn khung chỉnh sửa. Chỉ cần chọn một phân loại ở cột bên trái là có thể bắt đầu cập nhật.
                  </p>
                </div>      
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}