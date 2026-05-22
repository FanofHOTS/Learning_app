import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LibraryBig,
  FileIcon,
  Sparkles,
  FileQuestionIcon,
} from "lucide-react";
import { MockSessionControls } from "@/app/components/mock-session-controls";
import {
  FeatureCard,
  HeroSection,
  PublicSiteShell,
  SectionIntro,
} from "@/app/components/public-site-shell";
import { getAuthenticatedUser } from "@/app/lib/auth_server";
import { getRedirectPathByRole } from "@/app/lib/auth_paths";
import {
  getDashboardPathByRole,
  isMockDataEnabled,
  isUserRole,
} from "@/app/lib/public_site";

export const metadata: Metadata = {
  title: "Trang chủ | Trang web học tập",
  description:
    "Giới thiệu nền tảng học tập trực tuyến với khóa học, AI tạo câu hỏi và các khu vực quản lý dành cho từng vai trò.",
};

const ROLE_DASHBOARDS = [
  {
    role: "student",
    label: "Bảng điều khiển học viên",
    description: "Theo dõi khóa học đã tham gia, tiến độ và kết quả luyện tập.",
  },
  {
    role: "instructor",
    label: "Bảng điều khiển giảng viên",
    description: "Quản lý khóa học, tài liệu, bài kiểm tra và hoạt động lớp học.",
  },
  {
    role: "admin",
    label: "Bảng điều khiển quản trị viên",
    description: "Giám sát người dùng, khóa học và vận hành toàn hệ thống.",
  },
] as const;

export default async function HomePage() {
  const currentUser = await getAuthenticatedUser();
  const mockModeEnabled = isMockDataEnabled();
  const currentMockRole =
    currentUser && isUserRole(currentUser.role) ? currentUser.role : null;

  if (currentUser) {
    redirect(getRedirectPathByRole(currentUser));
  }

  return (
    <PublicSiteShell activePath="/" user={currentUser}>
      <div className="space-y-30">
        <HeroSection
          title="Một trang web lý tưởng cho việc học tập trực tuyến"
          description="Trong trang web này, học sinh có thể học tập trực tuyến qua việc tham gia các khóa học trực tuyến do trang cung cấp và tự rèn luyện, củng cố kiến thức qua các bài kiểm tra với sự trợ giúp của trợ lý ai."
          actions={[
            {
              href: "/register",
              label: "Đăng ký ngay",
            },
            {
              href: "/login",
              label: "Bạn đã có tài khoản?",
              variant: "secondary",
            },
          ]}
          badges={[
           /* {
              label: "Dành cho ba vai trò học tập cốt lõi",
              value: "Học viên, giảng viên, quản trị viên",
            },
            {
              label: "Ưu tiên tải nhanh, hạn chế gọi API công khai",
              value: "Dựng sẵn nội dung bằng App Router",
            },
            {
              label: "Tương thích tốt với backend hiện có",
              value: "Sẵn sàng nối tiếp với FastAPI",
            },*/
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-4xl bg-slate-950 p-6 text-white shadow-[0_30px_100px_-54px_rgba(15,23,42,0.95)]">
                <div className="flex items-center justify-between gap-3">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="my-5 text-2xl font-semibold">
                  Những điểm hấp dẫn
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-5">
                  <LibraryBig className="h-6 w-6 text-cyan-800" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Khóa học
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Những khóa học hấp dẫn thuộc các lĩnh vực mà học sinh quan tâm
                  </p>
                </div>
                <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
                  <FileIcon className="h-6 w-6 text-amber-900" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Ôn tập
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Tự ôn tập, rèn luyện bản thân qua các bài kiểm tra với sự trợ giúp của ai
                  </p>
                </div>               
              </div>
            </div>
          }
        />

        {mockModeEnabled ? (
          <section className="space-y-6">
            <SectionIntro
              title="Khu vực thử nhanh với dữ liệu cho sẵn"
              description="Vì môi trường hiện tại vẫn đang dùng dữ liệu giả lập, trang chủ hiển thị thêm nút đi thẳng vào dashboard của từng vai trò và khu vực đổi nhanh trạng thái đăng nhập để kiểm tra thanh thông tin người dùng."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              {ROLE_DASHBOARDS.map((item) => (
                <Link
                  key={item.role}
                  href={getDashboardPathByRole(item.role)}
                  className="rounded-[30px] border border-white/85 bg-white/90 p-6 shadow-[0_30px_90px_-54px_rgba(15,23,42,0.8)] transition hover:-translate-y-1 hover:shadow-[0_35px_110px_-58px_rgba(15,23,42,0.9)]"
                >
                  <p className="text-sm font-semibold text-cyan-800">
                    Truy cập trực tiếp
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950">
                    {item.label}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>

            {/*<MockSessionControls currentRole={currentMockRole} />*/}
          </section>
        ) : null}

        <HeroSection
          title="Bạn là giảng viên?"
          description="Bạn là giảng viên hay chỉ đơn giản muốn cung cấp những khóa học trực tuyến? Vậy bạn hãy tham gia vào hệ sinh thái của trang web, góp phần làm giàu kho khóa học của trang."
          actions={[
            {
              href: "mailto:vothienson888@gmail.com?subject=H%E1%BB%97%20tr%E1%BB%A3%20t%E1%BB%AB%20trang%20web%20h%E1%BB%8Dc%20t%E1%BA%ADp",
              label: "Liên hệ chúng tôi",
            },
            {
              href: "/login",
              label: "Bạn đã có tài khoản?",
              variant: "secondary",
            },
          ]}
          badges={[
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-4xl bg-slate-950 p-6 text-white shadow-[0_30px_100px_-54px_rgba(15,23,42,0.95)]">
                <div className="flex items-center justify-between gap-3">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="my-5 text-2xl font-semibold">
                  Những điểm hấp dẫn
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-5">
                  <LibraryBig className="h-6 w-6 text-cyan-800" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Khóa học
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Tạo khóa học một cách nhanh chóng với tài liệu và bài kiểm tra
                  </p>
                </div>
                <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
                  <FileQuestionIcon className="h-6 w-6 text-amber-900" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Bài kiểm tra
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Tạo bộ câu hỏi cho các bài kiểm tra với sự giúp đỡ của trợ lý ai
                  </p>
                </div>              
              </div>
            </div>
          }
        />

        {/*<section className="rounded-[36px] border border-white/85 bg-slate-950 px-7 py-8 text-white shadow-[0_30px_90px_-58px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Bạn là giảng viên?
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Gửi yêu cầu qua email quản trị hoặc đăng nhập để chuyển sang khu
                vực làm việc phù hợp với vai trò hiện tại của bạn.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="mailto:vothienson888@gmail.com?subject=H%E1%BB%97%20tr%E1%BB%A3%20t%E1%BB%AB%20trang%20web%20h%E1%BB%8Dc%20t%E1%BA%ADp"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Gửi email quản trị
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Đã có tài khoản
              </Link>
            </div>
          </div>
        </section>*/}
      </div>
    </PublicSiteShell>
  );
}
