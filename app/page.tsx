import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  Bot,
  ChartNoAxesCombined,
  FolderKanban,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { MockSessionControls } from "@/app/components/mock-session-controls";
import {
  FeatureCard,
  HeroSection,
  PublicSiteShell,
  SectionIntro,
} from "@/app/components/public-site-shell";
import { getAuthenticatedUser } from "@/app/lib/auth_server";
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

  return (
    <PublicSiteShell activePath="/" user={currentUser}>
      <div className="space-y-10">
        <HeroSection
          title="Một trang web học tập giúp người học, giảng viên và quản trị viên làm việc trên cùng một hành trình"
          description="Nền tảng này giới thiệu đầy đủ khóa học, AI tạo câu hỏi và các luồng quản trị theo vai trò. Giao diện công khai ưu tiên nội dung dựng sẵn bằng tiếng Việt để tải nhanh, còn phiên đăng nhập sẽ đọc trực tiếp từ cookie trên server khi cần."
          actions={[
            {
              href: "/courses",
              label: "Khám phá trang khóa học",
            },
            {
              href: "/ai-generator",
              label: "Xem trang AI tạo câu hỏi",
              variant: "secondary",
            },
          ]}
          badges={[
            {
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
            },
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-4xl bg-slate-950 p-6 text-white shadow-[0_30px_100px_-54px_rgba(15,23,42,0.95)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    Hành trình học tập
                  </span>
                  <Sparkles className="h-5 w-5 text-amber-300" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold">
                  Từ giới thiệu trang web đến dashboard đúng vai trò chỉ qua một
                  luồng điều hướng
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Người dùng có thể bắt đầu từ các trang công khai, chuyển sang
                  khóa học, thử AI tạo câu hỏi và đi thẳng đến khu vực làm việc
                  sau khi đăng nhập bằng phiên đăng nhập.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-5">
                  <GraduationCap className="h-6 w-6 text-cyan-800" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Học viên
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Học theo lộ trình, làm bài kiểm tra và theo dõi tiến bộ.
                  </p>
                </div>
                <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
                  <BookOpenCheck className="h-6 w-6 text-amber-900" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Giảng viên
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Tổ chức nội dung, quản lý tài liệu và tạo đánh giá linh hoạt.
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <ShieldCheck className="h-6 w-6 text-slate-900" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    Quản trị viên
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Quản lý người dùng, khóa học và chất lượng hệ thống.
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

            <MockSessionControls currentRole={currentMockRole} />
          </section>
        ) : null}

        <section className="space-y-6">
          <SectionIntro
            title="Những phần cốt lõi của nền tảng"
            description="Thiết kế mới của trang chủ tập trung vào việc giải thích rõ trang web dùng để làm gì, ai sẽ sử dụng và mỗi nhóm người dùng nhận được giá trị gì ngay từ lần truy cập đầu tiên."
            align="center"
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <FeatureCard
              icon={FolderKanban}
              title="Khóa học được tổ chức theo hành trình"
              description="Mỗi khóa học có thể mở rộng dần từ phần giới thiệu, tài liệu, bài kiểm tra đến theo dõi tiến độ mà không làm nặng trang công khai."
            />
            <FeatureCard
              icon={Bot}
              title="AI hỗ trợ tạo câu hỏi nhanh"
              description="Trang AI tạo câu hỏi được thiết kế để giới thiệu rõ luồng nhập nội dung, sinh câu hỏi và dùng lại cho cả người học lẫn người dạy."
              accent="amber"
            />
            <FeatureCard
              icon={UsersRound}
              title="Điều hướng theo đúng vai trò"
              description="Khi có phiên đăng nhập, hai nút đăng nhập và đăng ký sẽ tự chuyển thành thanh thông tin người dùng với menu dashboard, hồ sơ, đổi mật khẩu và đăng xuất."
              accent="slate"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[34px] border border-white/85 bg-white/90 p-7 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.85)]">
            <SectionIntro
              title="Luồng vận hành ngắn gọn nhưng đủ rõ"
              description="Trang công khai ưu tiên thuyết minh sản phẩm. Các thao tác dữ liệu chi tiết sẽ được đưa vào dashboard và các trang nghiệp vụ chuyên biệt để tránh gọi API dàn trải."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Khám phá nền tảng và hiểu nhanh các vai trò ngay tại trang chủ.",
              "Xem trang AI tạo câu hỏi để biết cách chuyển tài liệu thành câu hỏi luyện tập.",
              "Mở trang khóa học để nắm cấu trúc học liệu, mô-đun và đánh giá.",
              "Liên hệ quản trị viên khi cần hỗ trợ tài khoản, nội dung hoặc tích hợp.",
            ].map((item, index) => (
              <div
                key={item}
                className="rounded-[28px] border border-slate-200 bg-slate-50/92 p-5"
              >
                <p className="text-sm font-semibold text-cyan-800">
                  Bước {index + 1}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <FeatureCard
            icon={ChartNoAxesCombined}
            title="Sẵn sàng mở rộng sang báo cáo và thống kê"
            description="Phần giới thiệu đã định vị rõ các vai trò nên việc dẫn người dùng sang báo cáo, tiến độ và bảng điều khiển sau này sẽ tự nhiên hơn, không cần thêm lời giải thích dài ở mỗi trang."
          />
          <FeatureCard
            icon={Sparkles}
            title="Thiết kế thống nhất cho toàn bộ nhóm trang công khai"
            description="Trang chủ, AI tạo câu hỏi, khóa học và liên hệ cùng dùng chung một bộ điều hướng, footer và trạng thái phiên để giữ trải nghiệm nhất quán."
            accent="amber"
          />
        </section>
      </div>
    </PublicSiteShell>
  );
}
