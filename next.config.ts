import type { NextConfig } from "next";

const minioImagePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL?.trim();
  if (!configuredUrl) {
    return [];
  }

  try {
    const minioUrl = new URL(configuredUrl);
    return [
      {
        protocol: minioUrl.protocol.slice(0, -1) as "http" | "https",
        hostname: minioUrl.hostname,
        port: minioUrl.port,
        pathname: `${minioUrl.pathname.replace(/\/$/, "")}/**`,
      },
    ];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowLocalIP:
      process.env.ALLOW_PRIVATE_MINIO_IMAGES === "true",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/documents/**",
      },
      ...minioImagePatterns,
    ],
  },
};

export default nextConfig;
