"use client"
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen items-center justify-between pt-20">
      <header className="flex flex-row items-center fixed z-50 top-0 left-0 w-full bg-white shadow-md px-3">
        <div className= "flex-4 flex items-center">
          <Image
            className=""
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            onClick={() =>router.push("/")}
          />
          <h2 className= "pl-1.5 flex-auto" onClick={() =>router.push("/")}>Trang Web Học Tập</h2>
        </div>
        <div className= "flex-8 flex h-full">
          <button className="hover:bg-gray-200 px-4 py-2 flex-1" onClick={() =>router.push("/")}>
          Trang chủ
          </button>
          <button className="hover:bg-gray-200 px-4 py-2 flex-1">
          Tạo câu hỏi
          </button>
          <button className="hover:bg-gray-200 px-4 py-2 flex-1">
          Khóa học
          </button>
          <button className="hover:bg-gray-200 px-4 py-2 flex-1">
          Liên hệ
          </button>
        </div>
        <div className= "flex-4 flex">
          <button className="ml-6 mr-2 border border-blue-500 px-4 py-2 text-blue-500 rounded bg-white font-bold focus:outline-none focus:shadow-outline hover:bg-blue-200" onClick={() =>router.push("/login")}>
            Đăng nhập
          </button>
          <button className="rounded bg-blue-500 px-4 py-2 font-bold text-white focus:outline-none focus:shadow-outline hover:bg-blue-700" onClick={() =>router.push("/register")}>
            Đăng ký
          </button>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center pb-16">
        <h1 className="mb-4 text-5xl font-bold">Chào mừng bạn đến với trang web học tập trực tuyến</h1>
        <p className="mb-4 text-5xl"> Đây là trang web mà người học có thể tham gia các khóa học trực tuyến</p>
      </div>
      <iframe
      src="/document/document_test.pdf"
      width="100%"
      height="800px"
      style={{ border: "none" }}
      />
      <div className="w-full bg-gray-100 py-4 text-center fixed bottom-0">
        <p className="text-gray-600">
          &copy; 2026 Trang Web Học Tập. Mọi quyền được bảo lưu.
        </p>
      </div>
    </main>
  );
}
