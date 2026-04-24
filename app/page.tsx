import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen items-center justify-between pt-32">
      <div className="item-center position: fixed z-10">
        <div>
        <Image
          className="mt-4"
          src="/logo.png"
          alt="Logo"
          width={40}
          height={40}
          priority
        />
        <p>Trang Web Học Tập</p>
        </div>
        <div>
          <button onClick={() =>router.push("/login")}>
            Đăng nhập
          </button>
          <button onClick={() =>router.push("/register")}>
            Đăng ký
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold">Chào mừng bạn đến với trang web học tập trực tuyến</h1>
        <p className="mb-4 text-5xl"> Đây là trang web mà người học có thể tham gia các khóa học trực tuyến</p>
      </div>
    </main>
  );
}
