"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  UserCircle2,
} from "lucide-react";

import type { User } from "@/app/lib/api_user";
import {
  getDashboardPathByRole,
  getProfilePathByRole,
  getRoleDescription,
  getRoleLabel,
} from "@/app/lib/public_site";

type UserAccountMenuProps = {
  user: User;
  variant?: "public" | "dashboard";
};

export function UserAccountMenu({
  user,
  variant = "public",
}: UserAccountMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setIsOpen(false);
      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    }
  }

  function handlePasswordChange() {
    setIsOpen(false);
    window.alert("Chức năng đổi mật khẩu sẽ sớm được cập nhật.");
  }

  const roleLabel = getRoleLabel(user.role);
  const initials = user.username
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const triggerClassName =
    variant === "dashboard"
      ? "flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-cyan-200 hover:bg-slate-50"
      : "flex items-center gap-3 rounded-full border border-white/65 bg-white/88 px-3 py-2 text-left shadow-[0_18px_40px_-26px_rgba(15,23,42,0.7)] backdrop-blur transition hover:border-cyan-200 hover:bg-white";

  const avatarClassName =
    variant === "dashboard"
      ? "flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
      : "flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className={triggerClassName}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className={avatarClassName}>{initials || "HV"}</span>
        <span className="hidden min-w-0 sm:flex sm:flex-col">
          <span className="truncate text-sm font-semibold text-slate-900">
            {user.username}
          </span>
          <span className="truncate text-xs text-slate-500">{roleLabel}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 z-30 mt-3 w-[min(92vw,320px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_26px_90px_-38px_rgba(15,23,42,0.75)]"
          role="menu"
        >
          <div className="rounded-[22px] bg-slate-950 px-4 py-4 text-white">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="mt-1 text-xs text-slate-300">{user.email}</p>
            <p className="mt-3 text-xs leading-6 text-slate-300">
              {getRoleDescription(user.role)}
            </p>
          </div>

          <div className="mt-3 space-y-1">
            <Link
              href={getDashboardPathByRole(user.role)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              role="menuitem"
            >
              <LayoutDashboard className="h-4 w-4 text-cyan-700" />
              <span>Đến bảng điều khiển</span>
            </Link>

            <Link
              href={getProfilePathByRole(user.role)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              role="menuitem"
            >
              <UserCircle2 className="h-4 w-4 text-cyan-700" />
              <span>Hồ sơ {roleLabel.toLowerCase()}</span>
            </Link>

            <button
              type="button"
              onClick={handlePasswordChange}
              className="flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              role="menuitem"
            >
              <KeyRound className="h-4 w-4 text-cyan-700" />
              <span>Đổi mật khẩu</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
              role="menuitem"
            >
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
