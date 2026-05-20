"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  ChartColumn,
  LayoutDashboard,
  UserCircle2,
  X,
  LibraryBig,
  FileArchiveIcon,
  FileQuestionIcon,
  List,
  Users,
} from "lucide-react";

import type { User } from "./api_user";

type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

type SidebarNavigationProps = {
  user: User;
  isOpen: boolean;
  onClose: () => void;
};

const roleBasePath: Record<string, string> = {
  admin: "/admin",
  instructor: "/instructor",
  student: "/student",
};

function getNavigationItems(role: string): NavigationItem[] {
  const basePath = roleBasePath[role] ?? "/student";

  if (role === "admin") {
    return [
      {
        id: "dashboard",
        label: "Bảng điều khiển",
        href: basePath,
        icon: LayoutDashboard,
      },
      {
        id: "profile",
        label: "Hồ sơ cá nhân",
        href: `${basePath}/profile`,
        icon: UserCircle2,
      },
      {
        id: "courses",
        label: "Quản lý khóa học",
        href: `${basePath}/courses`,
        icon: LibraryBig,
      },
      {
        id: "categories",
        label: "Quản lý phân loại",
        href: `${basePath}/category`,
        icon: List,
      },
      {
        id: "users",
        label: "Quản lý người dùng",
        href: `${basePath}/users`,
        icon: Users,
      },
      {
        id: "reports",
        label: "Tình hình trang web",
        href: `${basePath}/reports`,
        icon: ChartColumn,
      },
      {
        id: "ai-generator",
        label: "Tạo câu hỏi bằng AI",
        href: `${basePath}/ai-generator`,
        icon: Bot,
      },
    ];
  }

  if (role === "instructor") {
    return [
      {
        id: "dashboard",
        label: "Bảng điều khiển",
        href: basePath,
        icon: LayoutDashboard,
      },
      {
        id: "profile",
        label: "Hồ sơ cá nhân",
        href: `${basePath}/profile`,
        icon: UserCircle2,
      },
      {
        id: "courses",
        label: "Khóa học của tôi",
        href: `${basePath}/courses`,
        icon: LibraryBig,
      },
      {
        id: "documents",
        label: "Tài liệu",
        href: `${basePath}/document`,
        icon: FileArchiveIcon,
      },
      {
        id: "exams",
        label: "Bài kiểm tra",
        href: `${basePath}/exam`,
        icon: FileQuestionIcon,
      },
      {
        id: "reports",
        label: "Báo cáo khóa học",
        href: `${basePath}/reports`,
        icon: ChartColumn,
      },
      {
        id: "ai-generator",
        label: "Tạo câu hỏi bằng AI",
        href: `${basePath}/ai-generator`,
        icon: Bot,
      },
    ];
  }

  return [
    {
      id: "dashboard",
      label: "Bảng điều khiển",
      href: basePath,
      icon: LayoutDashboard,
    },
    {
      id: "profile",
      label: "Hồ sơ cá nhân",
      href: `${basePath}/profile`,
      icon: UserCircle2,
    },
    {
      id: "courses",
      label: "Khóa học của tôi",
      href: `${basePath}/courses`,
      icon: BookOpen,
    },
    {
      id: "public-courses",
      label: "Danh sách khóa học",
      href: `${basePath}/public_courses`,
      icon: LibraryBig,
    },
    {
      id: "reports",
      label: "Tiến độ học tập",
      href: `${basePath}/reports`,
      icon: ChartColumn,
    },
    {
      id: "ai-generator",
      label: "Tạo câu hỏi bằng AI",
      href: `${basePath}/ai-generator`,
      icon: Bot,
    },
  ];
}

export function ShowNavigation({
  user,
  isOpen,
  onClose,
}: SidebarNavigationProps) {
  const pathname = usePathname();
  const navigationItems = getNavigationItems(user.role);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Thanh điều hướng</p>
            <p className="text-xs text-slate-500">Điều hướng nhanh chóng</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Đóng thanh điều hướng"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {navigationItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== roleBasePath[user.role] &&
              pathname.startsWith(`${item.href}/`));

          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sky-600 text-white shadow-lg shadow-sky-200"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">{user.username}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
          {(user.role=="admin") ? (
            <p className="mt-3 text-xs leading-5 text-slate-600">
              Bạn là quản trị viên hệ thống. Hãy theo dõi người dùng, quản lý khóa học và đảm bảo mọi thứ hoạt động trơn tru.
            </p>
          ) : null}
          {(user.role=="instructor") ? (
            <p className="mt-3 text-xs leading-5 text-slate-600">
              Bạn đang ở trung tâm quản lý khóa học. Hãy theo dõi tiến độ học sinh, quản lý tài liệu và tạo đánh giá.
            </p>
          ) : null}
          {(user.role=="student") ? (
            <p className="mt-3 text-xs leading-5 text-slate-600">
              Học đều mỗi ngày sẽ giúp bạn giữ nhịp tiến bộ và hoàn thành khóa học
              dễ hơn.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export const ShowNavgavation = ShowNavigation;
