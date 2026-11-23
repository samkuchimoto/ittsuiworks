"use client";
/**
 * One employer email, signed by the person who sends it (23 Nov 2026; Rockefeller, letter 38: a real name, never a
 * team). The sender types their first and last name once; it is remembered in this browser and fills every email on
 * the page. The mail button stays off until the name is a full name, so no email leaves unsigned.
 */
import { useEffect, useState, type ReactNode } from "react";

const KEY = "iw_sender_name";
const EVENT = "iw-sender-name";
const TOKEN = "{sender}";

const fullName = (v: string) => v.trim().replace(/\s+/g, " ");
const isFullName = (v: string) => fullName(v).split(" ").length >= 2 && fullName(v).length >= 5;

export function SignedEmail({ to, subject, text, canSend, children }: { to: string; subject: string; text: string; canSend: boolean; children?: ReactNode }) {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      setName(localStorage.getItem(KEY) ?? "");
    } catch {
      // private window or storage blocked: the sender types it each time
    }
    const sync = (e: Event) => setName((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const change = (v: string) => {
    setName(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // not remembered; still used on this page
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
  };
  const signed = isFullName(name);
  const body = text.replace(TOKEN, signed ? fullName(name) : "(your first and last name)");
  return (
    <>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px]">
        <span className="font-semibold text-navy">Signed by</span>
        <input value={name} onChange={(e) => change(e.target.value)} maxLength={60} placeholder="Your first and last name" className="field w-[14rem] py-2 text-[14px]" />
        {!signed && <span className="text-orange-deep">Type your first and last name to sign it.</span>}
      </label>
      <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-3 text-[13.5px] leading-relaxed">{[`To: ${to}`, `Subject: ${subject}`, "", body].join("\n")}</pre>
      {canSend && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {signed ? (
            <a
              href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.split("\n").join("\r\n"))}`}
              className="rounded-md bg-navy px-4 py-2 font-semibold text-white"
            >
              Open in my mail app
            </a>
          ) : (
            <span className="rounded-md bg-mist px-4 py-2 font-semibold text-mute ring-1 ring-line">Open in my mail app (sign it first)</span>
          )}
          {children}
        </div>
      )}
    </>
  );
}
