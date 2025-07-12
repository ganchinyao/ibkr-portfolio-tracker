import { put } from "@vercel/blob";

export async function uploadContentToBlob(
  fileName: string,
  content: string,
  options?: {
    contentType?: string;
    cacheControlMaxAge?: number;
  }
): Promise<void> {
  await put(fileName, content, {
    access: "public",
    multipart: false,
    addRandomSuffix: false,
    contentType: options?.contentType,
    cacheControlMaxAge: options?.cacheControlMaxAge,
  });
}
