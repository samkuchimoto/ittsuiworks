import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/content";
import { Reveal } from "@/components/Reveal";
import { BRAND, SITE_URL, isLocale, locales } from "@/lib/site";
import { fontVariables } from "../fonts";
import "../globals.css";

// English and Japanese only; anything else is a 404 (RootLayout checks isLocale). dynamicParams stays true (16 Nov 2026,
// hosting fix 1): false here also applied to the job pages below, so a job not built at deploy time answered 404.
export const dynamicParams = true;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(SITE_URL),
    title: t.meta.title,
    description: t.meta.description,
    applicationName: BRAND,
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      siteName: BRAND,
      title: t.meta.title,
      description: t.meta.description,
      locale: lang === "ja" ? "ja_JP" : "en_US",
      images: [{ url: "/media/og.jpg", width: 1200, height: 630, alt: t.hero.images[0].alt }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={fontVariables}>
      <body>
        {children}
        <Reveal />
      </body>
    </html>
  );
}
