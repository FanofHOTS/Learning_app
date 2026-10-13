const MINIO_PUBLIC_URL = process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL;

export function isManagedUploadUrl(fileUrl: string | null | undefined): boolean {
  if (!fileUrl?.trim()) {
    return false;
  }

  const normalizedUrl = fileUrl.trim();
  if (normalizedUrl.startsWith("/uploads/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.hostname.endsWith(".public.blob.vercel-storage.com")) {
      return true;
    }

    if (!MINIO_PUBLIC_URL) {
      return false;
    }

    const minioBaseUrl = new URL(MINIO_PUBLIC_URL);
    const managedPathPrefix = `${minioBaseUrl.pathname.replace(/\/$/, "")}/`;
    return (
      parsedUrl.origin === minioBaseUrl.origin &&
      parsedUrl.pathname.startsWith(managedPathPrefix)
    );
  } catch {
    return false;
  }
}