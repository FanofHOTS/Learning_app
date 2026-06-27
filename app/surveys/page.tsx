import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  FileQuestion,
  Megaphone,
} from "lucide-react";

import {
  FeatureCard,
  HeroSection,
  PublicSiteShell,
  SectionIntro,
} from "@/app/components/public-site-shell";
import { getAuthenticatedUser } from "@/app/lib/auth_server";

export const metadata: Metadata = {
  title: "Khảo sát nhu cầu | Trang web học tập",
  description:
    "Tham gia khảo sát để góp ý cho các khóa học sắp tới — ý kiến của bạn giúp chúng tôi xây dựng nội dung phù hợp nhất.",
};

export default async function SurveysPage() {
  const currentUser = await getAuthenticatedUser();

  return (
    <PublicSiteShell activePath="/surveys" user={currentUser}>
      <div className="space-y-10">
        <HeroSection
          title="Khảo sát nhu cầu học tập"
          description="Trước khi xây dựng khóa học mới, chúng tôi muốn lắng nghe ý kiến của bạn. Tham gia khảo sát ngắn để góp phần định hướng nội dung giảng dạy và giúp khóa học đáp ứng đúng mong đợi của người học."
          actions={[
            {
              href: "/surveys#active-surveys",
              label: "Xem khảo sát đang mở",
            },
            {
              href: "/ai-generator",
              label: "Khám phá AI tạo câu hỏi",
              variant: "secondary",
            },
          ]}
          badges={[
            {
              label: "Phản hồi của bạn giúp cải thiện chất lượng khóa học",
              value: "Đóng góp ý kiến",
            },
            {
              label: "Chỉ mất 2–5 phút để hoàn thành mỗi khảo sát",
              value: "Khảo sát ngắn gọn",
            },
            {
              label: "Kết quả được tổng hợp công khai để minh bạch",
              value: "Minh bạch kết quả",
            },
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-[32px] bg-white p-6 shadow-[0_28px_90px_-54px_rgba(15,23,42,0.65)]">
                <p className="text-sm font-semibold text-cyan-800">
                  Tiếng nói của bạn
                </p>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  Mỗi ý kiến đều góp phần tạo nên khóa học chất lượng
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Các khảo sát công khai được sử dụng để thu thập nhu cầu học
                  tập trước khi chúng tôi xây dựng nội dung. Kết quả khảo sát sẽ
                  được tổng hợp và công bố minh bạch để cộng đồng cùng theo dõi.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-5">
                  <ClipboardList className="h-6 w-6 text-cyan-800" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Điền khảo sát nhanh
                  </p>
                </div>
                <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
                  <BarChart3 className="h-6 w-6 text-amber-800" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Xem kết quả tổng hợp
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <Megaphone className="h-6 w-6 text-slate-900" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Đề xuất chủ đề mới
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <section className="space-y-6" id="active-surveys">
          <SectionIntro
            title="Khảo sát đang mở"
            description="Dưới đây là các khảo sát hiện đang thu thập ý kiến. Hãy tham gia để đóng góp vào việc xây dựng khóa học mới!"
            align="center"
          />
        </section>

        <section className="rounded-[36px] border border-white/85 bg-slate-950 px-7 py-8 text-white shadow-[0_30px_90px_-58px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Danh sách khảo sát được tải động
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Trang này hiển thị danh sách khảo sát công khai đang hoạt động.
                Bạn cần đăng nhập với vai trò sinh viên để tham gia trả lời. Nếu
                bạn chưa có tài khoản, hãy đăng ký để bắt đầu đóng góp ý kiến!
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Đăng nhập để tham gia
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Đăng ký tài khoản
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[34px] border border-white/85 bg-white/90 p-7 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.85)]">
            <SectionIntro
              title="Cách hoạt động của khảo sát công khai"
              description="Giảng viên và quản trị viên tạo khảo sát để hỏi ý kiến sinh viên về các chủ đề khóa học tiềm năng. Mỗi khảo sát có thời hạn nhất định. Khi kết thúc, kết quả được tổng hợp để làm cơ sở xây dựng nội dung giảng dạy. Bạn cần đăng nhập để trả lời — mỗi tài khoản chỉ gửi một lần duy nhất."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-cyan-800">Bước 1</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Giảng viên tạo khảo sát với các câu hỏi về chủ đề, nội dung và
                mục tiêu học tập mong muốn.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-cyan-800">Bước 2</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Sinh viên tham gia trả lời. Kết quả được tổng hợp theo thời gian
                thực và hiển thị dưới dạng thống kê.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-cyan-800">Bước 3</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Khi có đủ dữ liệu, giảng viên dựa trên kết quả để quyết định mở
                khóa học phù hợp với nhu cầu.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-cyan-800">Bước 4</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Kết quả khảo sát được công bố để cộng đồng thấy được quyết định
                dựa trên dữ liệu thực tế.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <FeatureCard
            icon={ClipboardList}
            title="Nhiều dạng câu hỏi"
            description="Hỗ trợ câu hỏi trắc nghiệm, chọn nhiều đáp án, văn bản tự do và đánh giá theo thang điểm — linh hoạt cho mọi nhu cầu khảo sát."
          />
          <FeatureCard
            icon={BarChart3}
            title="Kết quả minh bạch"
            description="Giảng viên và quản trị viên xem báo cáo tổng hợp chi tiết: biểu đồ lựa chọn, câu trả lời văn bản và điểm đánh giá trung bình."
            accent="amber"
          />
          <FeatureCard
            icon={Clock}
            title="Có thời hạn rõ ràng"
            description="Mỗi khảo sát có thời gian kết thúc cụ thể. Sinh viên biết rõ hạn cuối để tham gia, giúp việc thu thập dữ liệu đúng tiến độ."
            accent="slate"
          />
        </section>
      </div>
    </PublicSiteShell>
  );
}
