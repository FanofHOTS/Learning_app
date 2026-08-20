import { Suspense } from "react";

import VerifyEmailContent from "./verify-email-content";

function VerifyEmailLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),linear-gradient(135deg,#f1f8ff_0%,#f8fbff_55%,#eefcf8_100%)] px-4 py-12">
      <div className="w-full max-w-xl rounded-[32px] border border-white/80 bg-white/90 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Xác thực email
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Đang xử lý liên kết xác thực...
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
