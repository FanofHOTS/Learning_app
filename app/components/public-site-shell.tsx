import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import type { User } from "@/app/lib/api_user";
import { PUBLIC_NAV_ITEMS } from "@/app/lib/public_site";

import { UserAccountMenu } from "./user-account-menu";

type PublicSiteShellProps = {
  activePath: string;
  user: User | null;
  children: ReactNode;
};

type SectionIntroProps = {
  title: string;
  description: string;
  align?: "left" | "center";
};

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: "cyan" | "amber" | "slate";
};

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type HeroBadge = {
  label: string;
  value: string;
};

type HeroSectionProps = {
  title: string;
  description: string;
  actions: HeroAction[];
  badges: HeroBadge[];
  spotlight: ReactNode;
};

export function PublicSiteShell({
  activePath,
  user,
  children,
}: PublicSiteShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 pt-4">
          <div className="rounded-4xl border border-white/75 bg-white/82 px-5 py-4 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.6)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-slate-950 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)]"
                >
                  <Image
                    src="/logo.png"
                    alt="Trang web học tập"
                    width={42}
                    height={42}
                    className="h-10 w-10 object-contain"
                    priority
                  />
                </Link>
                <div>
                  <Link
                    href="/"
                    className="text-lg font-semibold tracking-tight text-slate-950"
                  >
                    Trang web học tập trực tuyến
                  </Link>
                  <p className="text-sm text-slate-500">
                    {/*Học tập, tạo câu hỏi và quản lý khóa học trên cùng một nền
                    tảng.*/}
                    Trang học tập và quản lý khóa học trực tuyến.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <nav className="flex flex-wrap gap-2">
                  {PUBLIC_NAV_ITEMS.map((item) => {
                    const isActive = item.href === activePath;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-950 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.8)]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-3">
                  {user ? (
                    <UserAccountMenu user={user} variant="public" />
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="inline-flex items-center justify-center rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-50"
                      >
                        Đăng nhập
                      </Link>
                      <Link
                        href="/register"
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Đăng ký
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 py-8">{children}</main>

        <footer className="mt-10 rounded-4xl border border-white/80 bg-white/78 px-6 py-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.65)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950">
                Trang web học tập sử dụng Next.js và FastAPI
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Các trang giới thiệu ưu tiên dựng sẵn nội dung để tải nhanh và
                chỉ đọc phiên người dùng khi cần, giúp hạn chế gọi API trong khi
                vẫn giữ luồng chuyển sang dashboard, hồ sơ và các khu vực học
                tập đúng vai trò.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function HeroSection({
  title,
  description,
  actions,
  badges,
  spotlight,
}: HeroSectionProps) {
  return (
    <section className="grid gap-8 rounded-[40px] border border-white/75 bg-white/80 p-6 shadow-[0_35px_100px_-60px_rgba(15,23,42,0.8)] backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
      <div className="flex flex-col justify-between">
        <div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            {description}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                  action.variant === "secondary"
                    ? "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                    : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                <span>{action.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/90 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-950">
                  {badge.value}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  {badge.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex">{spotlight}</div>
    </section>
  );
}

export function SectionIntro({
  title,
  description,
  align = "left",
}: SectionIntroProps) {
  return (
    <div
      className={`${
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"
      }`}
    >
      <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-8 text-slate-600 sm:text-lg">
        {description}
      </p>
    </div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  accent = "cyan",
}: FeatureCardProps) {
  const accentClassName =
    accent === "amber"
      ? "bg-amber-100 text-amber-900"
      : accent === "slate"
        ? "bg-slate-200 text-slate-900"
        : "bg-cyan-100 text-cyan-900";

  return (
    <article className="rounded-[30px] border border-white/85 bg-white/88 p-6 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.75)]">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-[18px] ${accentClassName}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </article>
  );
}
