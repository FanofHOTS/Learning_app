"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import type { UserRole } from "@/app/lib/public_site";

type MockSessionControlsProps = {
  currentRole: UserRole | null;
};

const ROLE_OPTIONS: Array<{ role: UserRole; label: string; note: string }> = [
  {
    role: "student",
    label: "Mô phỏng sinh viên",
    note: "Xem giao diện thanh thông tin cho người học.",
  },
  {
    role: "instructor",
    label: "Mô phỏng giảng viên",
    note: "Kiểm tra đường dẫn hồ sơ và bảng điều khiển của giảng viên.",
  },
  {
    role: "admin",
    label: "Mô phỏng quản trị viên",
    note: "Thử menu người dùng dành cho quản trị hệ thống.",
  },
];

export function MockSessionControls({
  currentRole,
}: MockSessionControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function refreshPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function setRole(role: UserRole) {
    await fetch("/api/auth/mock-session", {
      body: JSON.stringify({ role }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    await refreshPage();
  }

  async function clearRole() {
    await fetch("/api/auth/mock-session", {
      method: "DELETE",
    });

    await refreshPage();
  }

  return (
    <div className="rounded-4xl border border-amber-200 bg-amber-50/90 p-6 shadow-[0_24px_70px_-45px_rgba(180,83,9,0.55)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Môi trường demo đang dùng dữ liệu cho sẵn
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">
            Kiểm tra nhanh trạng thái đăng nhập theo từng vai trò
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-amber-950/80">
            Các nút dưới đây chỉ xuất hiện khi hệ thống đang chạy bằng dữ liệu
            giả lập. Chúng giúp bạn đổi nhanh từ hai nút đăng nhập, đăng ký sang
            thanh thông tin người dùng để kiểm tra menu và điều hướng.
          </p>
        </div>

        <button
          type="button"
          onClick={clearRole}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Trở về trạng thái chưa đăng nhập
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {ROLE_OPTIONS.map((option) => {
          const isActive = currentRole === option.role;

          return (
            <button
              key={option.role}
              type="button"
              onClick={() => setRole(option.role)}
              disabled={isPending}
              className={`rounded-[26px] border px-5 py-5 text-left transition ${
                isActive
                  ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_-38px_rgba(15,23,42,0.85)]"
                  : "border-white bg-white text-slate-900 hover:border-amber-300 hover:bg-amber-100"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold">{option.label}</span>
                {isPending && isActive ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
              </div>
              <p
                className={`mt-2 text-sm leading-6 ${
                  isActive ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {option.note}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
