import Image from "next/image";

/**
 * Campaign / team hero image (the page's LCP element).
 *
 * Hero URLs come from free-text admin fields ("Hero image URL", team
 * "avatar_url"), so the src can be a local public path OR an arbitrary remote
 * URL. Local paths get full Next.js optimization — srcset + WebP/AVIF, so
 * phones don't download the full-width desktop banner. Remote URLs can't be
 * pre-allowlisted in next.config `remotePatterns`, so they degrade to a plain
 * <img> — that keeps an admin-pasted URL from 500ing the whole page.
 *
 * Either way the image loads at high priority: it's above the fold.
 */
export default function HeroImage({ src, alt }: { src: string; alt: string }) {
  const className = "block w-full h-auto max-h-[70vh] object-contain mx-auto";

  if (src.startsWith("/")) {
    return (
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={900}
        priority
        sizes="100vw"
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} fetchPriority="high" decoding="async" className={className} />
  );
}
