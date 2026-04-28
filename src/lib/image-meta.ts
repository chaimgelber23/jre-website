import "server-only";
import sharp from "sharp";
import path from "path";
import { cache } from "react";

export const getEventImageAspect = cache(
  async (imageUrl: string | null | undefined): Promise<number | null> => {
    if (!imageUrl || !imageUrl.startsWith("/images/")) return null;
    try {
      const fsPath = path.join(process.cwd(), "public", imageUrl);
      const meta = await sharp(fsPath).metadata();
      if (!meta.width || !meta.height) return null;
      return meta.width / meta.height;
    } catch {
      return null;
    }
  }
);
