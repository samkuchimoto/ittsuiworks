import type { Metadata } from "next";
import { Mark } from "@/components/Logo";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "404 | Ittsui Works" };

/** For URLs that match no page. The language is unknown here, so it speaks both. */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
          <Mark className="size-14" />
          <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.2em] text-orange">404</p>
          <h1 className="font-display mt-3 text-4xl text-navy">This page does not exist.</h1>
          <p lang="ja" className="mt-3 font-[family-name:var(--font-mincho)] text-2xl font-semibold text-navy">
            お探しのページは見つかりませんでした。
          </p>
          <div className="mt-8 flex gap-3">
            <a href="/" className="inline-flex h-12 items-center rounded-md bg-navy px-6 font-semibold text-white">
              Home
            </a>
            <a href="/ja" lang="ja" className="inline-flex h-12 items-center rounded-md px-6 font-semibold text-navy ring-1 ring-navy/25">
              ホーム
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
