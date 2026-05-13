import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

type AuthShellProps = {
  alternateHref: string;
  alternateLabel: string;
  alternateText: string;
  children: ReactNode;
  description: string;
  eyebrow: string;
  modeLabel: string;
  title: string;
};

const highlights = [
  {
    description: "Đồng bộ trực tiếp với API đăng nhập và hồ sơ người dùng.",
    icon: ShieldCheck,
    title: "Tích hợp FastAPI",
  },
  {
    description: "Phiên đăng nhập được lưu bằng cookie HttpOnly an toàn hơn.",
    icon: LockKeyhole,
    title: "Bảo mật phiên",
  },
  {
    description: "Điều hướng đúng bảng điều khiển theo vai trò người dùng.",
    icon: Sparkles,
    title: "Trải nghiệm liền mạch",
  },
];

export function AuthShell({
  alternateHref,
  alternateLabel,
  alternateText,
  children,
  description,
  eyebrow,
  modeLabel,
  title,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_36%),linear-gradient(135deg,_#eef6ff_0%,_#f8fbff_52%,_#effdfb_100%)]">
      <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="absolute -right-16 bottom-12 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="border-b border-slate-200/80 bg-white/80 px-6 py-5 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
                <Image
                  src="/logo.png"
                  alt="Biểu trưng trường học"
                  width={72}
                  height={72}
                  className="h-14 w-14 object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                  Trường Đại học Sư phạm Thành phố Hồ Chí Minh
                </p>
                <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
                  Hệ thống học tập trực tuyến
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Giao diện đăng nhập và đăng ký đồng bộ với bảng điều khiển học tập
                </p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <section className="relative overflow-hidden bg-slate-900 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.24),_transparent_35%),linear-gradient(180deg,_rgba(15,23,42,0.6)_0%,_rgba(15,23,42,0.95)_100%)]" />
              <div className="absolute left-10 top-16 h-32 w-32 rounded-full border border-white/10" />
              <div className="absolute bottom-12 right-10 h-40 w-40 rounded-full border border-cyan-300/10" />

              <div className="relative flex h-full flex-col justify-between gap-10">
                <div>
                  <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.26em] text-sky-100">
                    {modeLabel}
                  </span>
                  <h2 className="mt-5 max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
                    {title}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">
                    {description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {highlights.map((highlight) => {
                    const Icon = highlight.icon;

                    return (
                      <article
                        key={highlight.title}
                        className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-cyan-100">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-sm font-semibold text-white">
                          {highlight.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          {highlight.description}
                        </p>
                      </article>
                    );
                  })}
                </div>

                <div className="rounded-3xl border border-white/12 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm font-medium text-sky-100">{eyebrow}</p>
                  <p className="mt-3 text-lg font-semibold">
                    Thiết kế mới ưu tiên rõ ràng, nhanh và an toàn
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Mọi thông tin đăng nhập được chuyển qua route handler nội bộ của
                    Next.js trước khi kết nối sang FastAPI, giúp hạn chế lộ token ra
                    phía trình duyệt.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-white px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-lg">
                {children}

                <div className="mt-8 border-t border-slate-200 pt-6">
                  <p className="text-sm text-slate-500">{alternateText}</p>
                  <Link
                    href={alternateHref}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900"
                  >
                    <span>{alternateLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
