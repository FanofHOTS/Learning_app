import type { Metadata } from "next";
import Link from "next/link";
import {
  Bot,
  BrainCircuit,
  ClipboardList,
  FileText,
  ScanText,
  WandSparkles,
} from "lucide-react";

import {
  FeatureCard,
  HeroSection,
  PublicSiteShell,
  SectionIntro,
} from "@/app/components/public-site-shell";
import { getAuthenticatedUser } from "@/app/lib/auth_server";

export const metadata: Metadata = {
  title: "AI tạo câu hỏi | Trang web học tập",
  description:
    "Trang giới thiệu công cụ AI tạo câu hỏi từ nội dung bài học, tài liệu và ghi chú ôn tập.",
};

const AI_WORKFLOW = [
  {
    title: "Nhập nội dung bài học",
    description:
      "Dán nội dung, ghi chú hoặc đường dẫn tài liệu để hệ thống chuẩn bị nguồn dữ liệu đầu vào.",
  },
  {
    title: "Chọn mục tiêu tạo câu hỏi",
    description:
      "Thiết lập độ khó, số lượng câu hỏi và phong cách đánh giá phù hợp với môn học.",
  },
  {
    title: "Nhận bộ câu hỏi gợi ý",
    description:
      "Hệ thống trả về bộ câu hỏi có cấu trúc để tiếp tục luyện tập hoặc tinh chỉnh.",
  },
  {
    title: "Dùng lại trong khóa học",
    description:
      "Giảng viên có thể tái sử dụng cho đánh giá, còn học viên có thể dùng để tự ôn tập.",
  },
] as const;

export default async function AIGeneratorPage() {
  const currentUser = await getAuthenticatedUser();

  return (
    <PublicSiteShell activePath="/ai-generator" user={currentUser}>
      <div className="space-y-10">
        <HeroSection
          title="Trang AI tạo câu hỏi giúp biến tài liệu học thành bộ luyện tập có thể dùng ngay"
          description="Đây là khu vực giới thiệu rõ ràng cách người dùng có thể đi từ bài giảng, tài liệu hoặc ghi chú đến một bộ câu hỏi có cấu trúc. Trang được dựng sẵn bằng nội dung mô phỏng để nhẹ, nhanh và sẵn sàng nối tiếp với các router AI hiện có khi bật dữ liệu thật."
          actions={[
            {
              href: "/courses",
              label: "Xem cách AI hỗ trợ khóa học",
            },
            {
              href: "/contact",
              label: "Liên hệ để bật luồng thật",
              variant: "secondary",
            },
          ]}
          badges={[
            {
              label: "Hợp cho ghi chú, bài giảng và tài liệu PDF",
              value: "Đầu vào linh hoạt",
            },
            {
              label: "Dùng được cho cả người học lẫn người dạy",
              value: "Hai hướng sử dụng chính",
            },
            {
              label: "Giữ nhẹ phần giới thiệu công khai",
              value: "Chưa cần gọi API liên tục",
            },
          ]}
          spotlight={
            <div className="grid w-full gap-4">
              <div className="rounded-[32px] border border-cyan-100 bg-cyan-50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <Bot className="h-7 w-7 text-cyan-900" />
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-800">
                    Luồng mô phỏng
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  Từ nội dung thô đến bộ câu hỏi học tập chỉ qua vài bước ngắn
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Thiết kế trang này ưu tiên giải thích giá trị sản phẩm trước,
                  sau đó mới dẫn người dùng vào phần thao tác chuyên sâu trong
                  dashboard theo vai trò.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-white bg-white p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Dành cho học viên
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Tạo nhanh bộ câu hỏi ôn tập từ chương đang học để tự đánh giá
                    mức độ hiểu bài.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white bg-white p-5">
                  <p className="text-sm font-semibold text-slate-950">
                    Dành cho giảng viên
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Chuẩn bị câu hỏi nháp trước khi đưa vào bài kiểm tra hoặc bài
                    luyện trong khóa học.
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <section className="space-y-6">
          <SectionIntro
            title="Bốn bước để người dùng hiểu ngay AI này hoạt động ra sao"
            description="Vì đây là trang giới thiệu công khai, mỗi bước đều được trình bày bằng ngôn ngữ gần gũi và không phụ thuộc vào việc phải gọi backend ngay khi người dùng vừa mở trang."
            align="center"
          />

          <div className="grid gap-4 lg:grid-cols-4">
            {AI_WORKFLOW.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[30px] border border-white/85 bg-white/90 p-6 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.75)]"
              >
                <p className="text-sm font-semibold text-cyan-800">
                  Bước {index + 1}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <FeatureCard
            icon={FileText}
            title="Nội dung đầu vào dễ hình dung"
            description="Người dùng có thể chuẩn bị bài học dạng văn bản thuần, ghi chú chương hoặc tài liệu tham khảo trước khi dùng AI tạo câu hỏi."
          />
          <FeatureCard
            icon={ScanText}
            title="Gợi ý câu hỏi có định hướng"
            description="Trang nhấn mạnh khả năng tạo câu hỏi theo mục tiêu ôn tập, thay vì chỉ sinh ngẫu nhiên không bám nội dung."
            accent="amber"
          />
          <FeatureCard
            icon={ClipboardList}
            title="Có thể đưa vào quy trình học tập"
            description="Kết quả từ AI được giới thiệu như một bước trung gian để tiếp tục chuyển sang bài luyện, kiểm tra hoặc tự học."
            accent="slate"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[34px] border border-white/85 bg-white/90 p-7 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.85)]">
            <SectionIntro
              title="Tối ưu cho việc tích hợp FastAPI nhưng không lạm dụng request"
              description="Trang giới thiệu này không tự động bắn nhiều request mỗi lần mở. Khi cần kết nối thật, phần tạo câu hỏi chuyên sâu vẫn có thể dùng các API và router AI hiện hữu trong hệ thống."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <BrainCircuit className="h-6 w-6 text-cyan-800" />
              <h3 className="mt-4 text-xl font-semibold text-slate-950">
                Giao diện công khai nhẹ và rõ
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Thích hợp để giới thiệu sản phẩm, hướng dẫn kỳ vọng và dẫn người
                dùng sang khu vực thao tác thực tế sau khi đăng nhập.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <WandSparkles className="h-6 w-6 text-amber-700" />
              <h3 className="mt-4 text-xl font-semibold text-slate-950">
                Sẵn chỗ cho luồng thao tác thật
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Khi chuyển sang dashboard của từng vai trò, bạn có thể nối tiếp
                với các màn hình nghiệp vụ chi tiết mà không phải đổi mô hình
                điều hướng.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/85 bg-slate-950 px-7 py-8 text-white shadow-[0_30px_90px_-58px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Muốn dùng AI tạo câu hỏi theo quy trình thật?
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Bạn có thể bắt đầu từ trang giới thiệu này, sau đó chuyển sang
                đăng nhập hoặc liên hệ quản trị viên để được cấu hình tài khoản,
                dữ liệu và luồng tích hợp phù hợp.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Đăng nhập để tiếp tục
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
