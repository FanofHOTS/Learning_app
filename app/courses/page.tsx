import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  Boxes,
  ChartNoAxesCombined,
  FileStack,
  GraduationCap,
  ListChecks,
} from "lucide-react";

import {
  FeatureCard,
  HeroSection,
  PublicSiteShell,
  SectionIntro,
} from "@/app/components/public-site-shell";
import { getAuthenticatedUser } from "@/app/lib/auth_server";

export const metadata: Metadata = {
  title: "Khóa học | Trang web học tập",
  description:
    "Trang giới thiệu khu vực khóa học, lộ trình học, tài liệu và đánh giá trên nền tảng học tập.",
};

const COURSE_BLOCKS = [
  {
    title: "Lộ trình rõ ràng",
    description:
      "Khóa học được tổ chức thành các bước học, giúp người dùng biết mình đang ở đâu và cần làm gì tiếp theo.",
  },
  {
    title: "Tài liệu đi cùng bài học",
    description:
      "Bài đọc, video, tệp đính kèm và nội dung tham khảo có thể gắn trực tiếp với từng phần học.",
  },
  {
    title: "Bài kiểm tra gắn với mục tiêu",
    description:
      "Mỗi khóa học có thể đi kèm đánh giá ngắn hoặc kiểm tra tổng hợp để đo mức độ tiến bộ.",
  },
  {
    title: "Theo dõi tiến độ theo vai trò",
    description:
      "Học viên thấy tiến độ cá nhân, giảng viên theo dõi lớp học và quản trị viên nhìn ở cấp toàn hệ thống.",
  },
] as const;

export default async function CoursesPage() {
  const currentUser = await getAuthenticatedUser();

  return (
    <PublicSiteShell activePath="/courses" user={currentUser}>
      <div className="space-y-10">
        <HeroSection
          title="Trang khóa học giúp người dùng hiểu rõ nội dung học, cách theo dõi tiến độ và cách kết nối với đánh giá"
          description="Thay vì chỉ hiển thị một danh sách đơn giản, thiết kế mới của trang khóa học giới thiệu cách nền tảng tổ chức nội dung học tập, tài liệu và kiểm tra theo một hành trình liền mạch cho cả học viên, giảng viên và quản trị viên."
          actions={[
            {
              href: "/login",
              label: "Đăng nhập để vào khu vực học tập",
            },
            {
              href: "/ai-generator",
              label: "Khám phá AI tạo câu hỏi",
              variant: "secondary",
            },
          ]}
          badges={[
            {
              label: "Phù hợp cho giới thiệu khóa học công khai",
              value: "Nội dung dựng sẵn",
            },
            {
              label: "Có thể nối tiếp sang tài liệu và bài kiểm tra",
              value: "Luồng học tập liền mạch",
            },
            {
              label: "Hạn chế gọi API không cần thiết",
              value: "Ưu tiên nội dung tĩnh",
            },
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-[32px] bg-white p-6 shadow-[0_28px_90px_-54px_rgba(15,23,42,0.65)]">
                <p className="text-sm font-semibold text-cyan-800">
                  Trải nghiệm khóa học
                </p>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  Mỗi khóa học được nhìn như một hành trình hoàn chỉnh thay vì
                  một trang rời rạc
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Trang này ưu tiên giải thích cấu trúc khóa học để người dùng
                  mới biết họ sẽ nhận được gì ngay từ đầu, còn dữ liệu chi tiết
                  sẽ được mở trong dashboard sau khi đăng nhập.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-5">
                  <GraduationCap className="h-6 w-6 text-cyan-800" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Học viên xem lộ trình rõ ràng
                  </p>
                </div>
                <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
                  <BookOpenCheck className="h-6 w-6 text-amber-800" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Giảng viên chuẩn bị nội dung có hệ thống
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <ChartNoAxesCombined className="h-6 w-6 text-slate-900" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Quản trị viên nắm chất lượng vận hành
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <section className="space-y-6">
          <SectionIntro
            title="Những gì người dùng thấy trên trang khóa học"
            description="Phần giới thiệu khóa học được thiết kế để mô tả rõ giá trị của học liệu, cấu trúc mô-đun và các bước đánh giá, thay vì buộc người dùng phải đăng nhập mới hiểu nền tảng hoạt động thế nào."
            align="center"
          />

          <div className="grid gap-4 lg:grid-cols-4">
            {COURSE_BLOCKS.map((item) => (
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
            icon={Boxes}
            title="Mô-đun học tập có cấu trúc"
            description="Nội dung có thể được chia thành từng phần nhỏ, giúp người học theo dõi tiến độ thuận tiện và người dạy dễ quản lý."
          />
          <FeatureCard
            icon={FileStack}
            title="Tài liệu và nội dung số đi kèm"
            description="Trang này giới thiệu trước cách bài giảng, tài liệu và tệp học tập sẽ đồng hành cùng khóa học trong luồng học thực tế."
            accent="amber"
          />
          <FeatureCard
            icon={ListChecks}
            title="Đánh giá bám sát nội dung học"
            description="Bài luyện và bài kiểm tra có thể kết hợp với AI tạo câu hỏi để làm rõ hơn tiến bộ của người học."
            accent="slate"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[34px] border border-white/85 bg-white/90 p-7 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.85)]">
            <SectionIntro
              title="Tương thích với backend hiện có mà vẫn giữ trang công khai nhẹ"
              description="Phần frontend này được viết để sẵn sàng đi tiếp với các route và router khóa học, tài liệu, mô-đun, thành phần khóa học và bài kiểm tra trong FastAPI, nhưng bản thân trang giới thiệu không cần gọi nhiều API khi chỉ đang mô tả sản phẩm."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-cyan-800">
                Khi chưa đăng nhập
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Người dùng nắm được cấu trúc nền tảng, loại khóa học và cách học
                sẽ diễn ra trước khi đi sâu vào chi tiết.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-cyan-800">
                Khi đã có phiên
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Thanh thông tin người dùng trong header giúp chuyển thẳng sang
                dashboard hoặc hồ sơ đúng vai trò chỉ qua một lần bấm.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/85 bg-slate-950 px-7 py-8 text-white shadow-[0_30px_90px_-58px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Sẵn sàng bước vào khu vực học tập thật?
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Đăng nhập để truy cập bảng điều khiển, hoặc liên hệ quản trị viên
                nếu bạn cần tài khoản, tư vấn triển khai hoặc hỗ trợ nội dung
                khóa học.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Đăng nhập
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Liên hệ quản trị viên
              </Link>
            </div>
          </div>
        </section>
      </div>
    </PublicSiteShell>
  );
}
