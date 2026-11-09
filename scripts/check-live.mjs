// Checks the whole live site in one go, with no browser and no emails sent.
// Usage: npm run check:live            (https://ittsuiworks.com)
//        npm run check:live -- <base>  (a preview or local server)
// Exits with code 1 when anything fails, so it can gate a deploy.

const base = (process.argv[2] ?? "https://ittsuiworks.com").replace(/\/$/, "");
const apex = new URL(base).host;
const results = [];
const check = (pass, label) => results.push({ pass: Boolean(pass), label });
const get = (path, init = {}) => fetch(path.startsWith("http") ? path : base + path, { redirect: "manual", ...init });
const text = async (path, init) => (await get(path, init)).text();

// 1. Every page in the sitemap: status, language, title, description, canonical, hreflang, link preview.
const sitemap = await text("/sitemap.xml");
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
check(pages.length >= 4, `sitemap lists ${pages.length} pages`);
check((await text("/robots.txt")).includes("sitemap.xml"), "robots.txt points to the sitemap");

const assets = new Set();
for (const path of pages) {
  const res = await get(path);
  const html = await res.text();
  const lang = path === "/ja" || path.startsWith("/ja/") ? "ja" : "en";
  const attr = (re) => html.match(re)?.[1] ?? "";
  check(res.status === 200, `${path}: ${res.status}`);
  check(attr(/<html lang="([^"]+)"/) === lang, `${path}: html lang="${lang}"`);
  check(attr(/<title>([^<]+)<\/title>/).length > 10, `${path}: has a title`);
  check(attr(/<meta name="description" content="([^"]+)"/).length > 50, `${path}: has a description`);
  check(html.includes('rel="canonical"'), `${path}: has a canonical link`);
  check(["en", "ja", "x-default"].every((l) => html.includes(`hrefLang="${l}"`)), `${path}: links its other language (hreflang)`);
  check(!res.headers.get("x-powered-by"), `${path}: no X-Powered-By header`);

  // Visible text rules: no em dashes, no "coming soon".
  const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  check(!visible.includes("—"), `${path}: no em dash in the text`);
  check(!/coming soon|近日公開/i.test(visible), `${path}: no "coming soon"`);

  // Every in-page link has a section to land on.
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const missing = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))].filter((id) => !ids.has(id));
  check(missing.length === 0, `${path}: in-page links all land${missing.length ? " (missing #" + missing.join(", #") + ")" : ""}`);

  // Links to other pages of this site.
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) if (!m[1].startsWith("/_next")) assets.add(m[1]);
  // Images, video, posters, icons, link preview.
  for (const m of html.matchAll(/(?:src|poster|href|content)="(\/(?:media|icon|apple-icon)[^"]*)"/g)) assets.add(m[1]);
  for (const m of html.matchAll(/srcSet="([^"]+)"/g)) for (const part of m[1].split(",")) assets.add(part.trim().split(" ")[0]);
  const og = attr(/<meta property="og:image" content="([^"]+)"/);
  check(og.startsWith("https://"), `${path}: link preview image is a full URL`);
  if (og) assets.add(og);

  // Structured data parses.
  const ld = attr(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ld) check((() => { try { return JSON.parse(ld).name === "Ittsui Works"; } catch { return false; } })(), `${path}: structured data is valid`);
}

// 2. Every linked page and file answers, with the right type.
for (const url of [...assets].sort()) {
  const res = await get(url, url.endsWith(".mp4") ? { headers: { Range: "bytes=0-1" } } : { method: "HEAD" });
  const type = res.headers.get("content-type") ?? "";
  const expected = url.endsWith(".mp4") ? 206 : 200;
  const typed = /\.(webp|jpg|png|svg)/.test(url) ? type.startsWith("image/") : url.endsWith(".mp4") ? type === "video/mp4" : true;
  check(res.status === expected && typed, `${url.replace("https://" + apex, "")}: ${res.status} ${type.split(";")[0]}`);
}

// 3. Redirects and language routing.
const loc = (res) => (res.headers.get("location") ?? "").replace(base, "") || "(none)";
const r = async (label, path, init, status, to) => {
  const res = await get(path, init);
  check(res.status === status && (to === undefined || loc(res) === to), `${label}: ${res.status} -> ${loc(res)}`);
};
await r("www goes to the main domain", `https://www.${apex}/`, {}, 308);
await r("/en goes to /", "/en", {}, 308, "/");
await r("/en/privacy goes to /privacy", "/en/privacy", {}, 308, "/privacy");
await r("Japanese browser on / goes to /ja", "/", { headers: { "Accept-Language": "ja-JP,ja;q=0.9" } }, 307, "/ja");
await r("Japanese browser on /privacy goes to /ja/privacy", "/privacy", { headers: { "Accept-Language": "ja" } }, 307, "/ja/privacy");
await r("English chosen on a Japanese browser stays English", "/", { headers: { "Accept-Language": "ja", Cookie: "lang=en" } }, 200);
const notFound = await get("/this-page-does-not-exist");
const nf = await notFound.text();
check(notFound.status === 404 && nf.includes("does not exist") && nf.includes("見つかりません"), `unknown page: ${notFound.status}, in both languages`);

// 4. The form endpoint, without sending an email.
const post = (fields) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); return get("/api/contact", { method: "POST", body: f }); };
const empty = await post({ kind: "company" });
const emptyBody = await empty.json().catch(() => ({}));
check(empty.status === 400 && emptyBody.error === "invalid", `form refuses an empty request (${empty.status} ${emptyBody.error})`);
const bot = await post({ website: "spam", kind: "company" });
check(bot.status === 200, `form quietly drops bots (${bot.status})`);
check((await get("/api/contact")).status === 405, "form endpoint refuses GET");

// Report.
const failed = results.filter((x) => !x.pass);
for (const x of failed) console.log("FAIL ", x.label);
console.log(`\n${base}: ${results.length - failed.length} passed, ${failed.length} failed (${pages.length} pages, ${assets.size} links and files)`);
process.exit(failed.length ? 1 : 0);
