import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleHelp,
  Mail,
  MessagesSquare,
  ShieldCheck,
  UserRoundCog,
  Workflow,
} from "lucide-react";

import {
  FeatureCard,
  HeroSection,
  PublicSiteShell,
  SectionIntro,
} from "@/app/components/public-site-shell";
import { getAuthenticatedUser } from "@/app/lib/auth_server";

export const metadata: Metadata = {
  title: "Liên hệ quản trị viên | Trang web học tập",
  description:
    "Trang liên hệ quản trị viên để hỗ trợ tài khoản, vận hành khóa học và cấu hình hệ thống học tập.",
};

const CONTACT_REASONS = [
  {
    title: "Hỗ trợ tài khoản và phiên đăng nhập",
    description:
      "Dùng khi cần cấp tài khoản, rà soát quyền truy cập hoặc xử lý vấn đề đăng nhập theo vai trò.",
  },
  {
    title: "Tư vấn triển khai khóa học",
    description:
      "Phù hợp khi bạn muốn đưa khóa học, tài liệu hoặc quy trình đánh giá lên hệ thống.",
  },
  {
    title: "Trao đổi tích hợp và vận hành",
    description:
      "Áp dụng cho các nhu cầu cấu hình FastAPI, dữ liệu thật hoặc tinh chỉnh quy trình quản trị.",
  },
] as const;

export default async function ContactPage() {
  const currentUser = await getAuthenticatedUser();

  return (
    <PublicSiteShell activePath="/contact" user={currentUser}>
      <div className="space-y-10">
        <HeroSection
          title="Trang liên hệ quản trị viên giúp người dùng biết khi nào cần hỗ trợ và sẽ được hỗ trợ theo cách nào"
          description="Trang này được thiết kế như điểm kết nối giữa phần giới thiệu công khai và đội ngũ vận hành hệ thống. Người dùng có thể hiểu rõ kênh liên hệ, loại yêu cầu phù hợp và cách phối hợp khi cần tài khoản, khóa học hoặc cấu hình tích hợp."
          actions={[
            {
              href: "/login",
              label: "Đăng nhập nếu đã có tài khoản",
            },
            {
              href: "/courses",
              label: "Xem lại khu vực khóa học",
              variant: "secondary",
            },
          ]}
          badges={[
            {
              label: "Hỗ trợ dành cho tài khoản, nội dung và vận hành",
              value: "Ba nhóm yêu cầu chính",
            },
            {
              label: "Phù hợp cho người dùng mới lẫn đội ngũ nội bộ",
              value: "Một trang liên hệ thống nhất",
            },
            {
              label: "Không cần gọi API để hiển thị thông tin cơ bản",
              value: "Nhanh và ổn định",
            },
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-[32px] border border-amber-100 bg-amber-50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <UserRoundCog className="h-7 w-7 text-amber-900" />
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                    Hỗ trợ quản trị
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  Một điểm chạm rõ ràng cho mọi câu hỏi về tài khoản và hệ thống
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Thay vì để người dùng đoán xem nên liên hệ ở đâu, trang này
                  gom tất cả nhu cầu hỗ trợ vào một cấu trúc thống nhất, rõ vai
                  trò và dễ đi tiếp.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-white bg-white p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Phản hồi định hướng
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Giúp người dùng mới biết cần chuẩn bị thông tin gì trước khi
                    gửi yêu cầu.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white bg-white p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Tăng tính kết nối
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Liên kết tự nhiên với đăng nhập, khóa học và khu vực AI tạo
                    câu hỏi trên toàn bộ site.
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <section className="space-y-6">
          <SectionIntro
            title="Những lý do thường gặp để liên hệ quản trị viên"
            description="Các nhóm nhu cầu dưới đây được viết rõ để người dùng biết mình nên tìm đến ai và kỳ vọng điều gì trước khi đi vào các màn hình thao tác thực tế."
            align="center"
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {CONTACT_REASONS.map((item) => (
              <article
                key={item.title}
                className="rounded-[30px] border border-white/85 bg-white/90 p-6 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.75)]"
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <FeatureCard
            icon={Mail}
            title="Email hỗ trợ"
            description="vothienson888@gmail.com là đầu mối phù hợp khi cần mô tả vấn đề dài, đính kèm thông tin và theo dõi lịch sử hỗ trợ."
          />
          <FeatureCard
            icon={MessagesSquare}
            title="Trao đổi nghiệp vụ"
            description="Dành cho nhu cầu tư vấn xây dựng khóa học, triển khai tài liệu, tổ chức kiểm tra hoặc mở rộng quy trình học tập."
            accent="amber"
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Yêu cầu liên quan bảo mật"
            description="Áp dụng cho các vấn đề quyền truy cập, kiểm tra vai trò, rà soát phiên đăng nhập hoặc cấu hình quản trị."
            accent="slate"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[34px] border border-white/85 bg-white/90 p-7 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.85)]">
            <SectionIntro
              title="Phần liên hệ được thiết kế để nối mượt với hệ thống thật"
              description="Trang hiện tại chủ yếu giới thiệu đầu mối hỗ trợ nên không cần phụ thuộc dữ liệu động. Khi cần tích hợp sâu hơn, nó vẫn có thể dẫn người dùng tới luồng quản trị hoặc các form chuyên biệt về sau."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <CircleHelp className="h-6 w-6 text-cyan-800" />
              <h3 className="mt-4 text-xl font-semibold text-slate-950">
                Gợi ý cách gửi yêu cầu
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Mô tả vai trò của bạn, vấn đề đang gặp và mong muốn xử lý để đội
                quản trị định hướng nhanh hơn.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <Workflow className="h-6 w-6 text-amber-700" />
              <h3 className="mt-4 text-xl font-semibold text-slate-950">
                Giữ nhịp vận hành ổn định
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Từ hỗ trợ tài khoản đến mở rộng tích hợp, mọi yêu cầu đều có thể
                quay về đúng người phụ trách qua cùng một trang liên hệ này.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/85 bg-slate-950 px-7 py-8 text-white shadow-[0_30px_90px_-58px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Cần quản trị viên hỗ trợ ngay bây giờ?
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
                Đăng nhập
              </Link>
            </div>
          </div>
        </section>
      </div>
    </PublicSiteShell>
  );
}
