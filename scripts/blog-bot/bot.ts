/**
 * AddressLine1 블로그 자동 생성 봇
 *
 * 사용법:
 *   npx tsx scripts/blog-bot/bot.ts          # 한 사이클 (글 1편 작성)
 *   npx tsx scripts/blog-bot/bot.ts --loop   # 무한 루프 (systemd용)
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { callLLMWithRetry } from "../shared/llm";
import { fetchGSCReport, formatGSCReport, GSCReport } from "./gsc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "../..");
const BLOG_DIR = join(PROJECT_DIR, "app/blog");
const SITEMAP_FILE = join(PROJECT_DIR, "app/sitemap.ts");
const DATA_DIR = join(__dirname, "data");
const LAST_RUN_FILE = join(DATA_DIR, "last-run.txt");
const STOP_FILE = join(DATA_DIR, "bot.stop");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const INTERVAL_MS = 48 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

const SEED_CATEGORIES = [
  "Address Line 1/2 뜻과 작성법",
  "해외 직구 주소 입력 가이드 (Amazon, eBay, iHerb, 알리익스프레스)",
  "해외 서비스 가입 주소 입력 (PayPal, Netflix, Apple, Nike)",
  "영문주소 일반 (로마자 표기법, 도로명/지번, 우편번호)",
  "해외 배송/통관 주소 관련 팁",
];

function getExistingSlugs(): string[] {
  if (!existsSync(BLOG_DIR)) return [];
  return readdirSync(BLOG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(BLOG_DIR, d.name, "page.tsx")))
    .map((d) => d.name);
}

function getExistingPostTitles(): { slug: string; title: string }[] {
  return getExistingSlugs().map((slug) => {
    const content = readFileSync(join(BLOG_DIR, slug, "page.tsx"), "utf-8");
    const titleMatch = content.match(/headline:\s*'([^']+)'/);
    return { slug, title: titleMatch?.[1] || slug };
  });
}

function shouldWrite(): boolean {
  if (!existsSync(LAST_RUN_FILE)) return true;
  const lastRun = parseInt(readFileSync(LAST_RUN_FILE, "utf-8").trim(), 10);
  return Date.now() - lastRun >= INTERVAL_MS;
}

function shouldRefresh(): boolean {
  const f = join(DATA_DIR, "last-refresh.txt");
  if (!existsSync(f)) return true;
  return Date.now() - parseInt(readFileSync(f, "utf-8").trim(), 10) >= REFRESH_INTERVAL_MS;
}

function markRun() { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(LAST_RUN_FILE, Date.now().toString()); }
function markRefresh() { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(join(DATA_DIR, "last-refresh.txt"), Date.now().toString()); }

async function sendTelegram(msg: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }),
    });
  } catch { /* ignore */ }
}

async function pickTopic(existingSlugs: string[], gscReport?: GSCReport | null): Promise<{ title: string; category: string }> {
  const catIndex = existingSlugs.length % SEED_CATEGORIES.length;
  const targetCategory = SEED_CATEGORIES[catIndex];

  let gscHint = "";
  if (gscReport) {
    const opportunities: string[] = [];
    for (const q of gscReport.underperforming.slice(0, 5)) opportunities.push(`"${q.query}" (노출 ${q.impressions}, 순위 ${q.position.toFixed(0)}위)`);
    for (const q of gscReport.lowCTR.slice(0, 3)) opportunities.push(`"${q.query}" (노출 ${q.impressions}, CTR ${(q.ctr * 100).toFixed(1)}%)`);
    if (opportunities.length > 0) gscHint = `\n\nGSC 기회 키워드:\n${opportunities.join("\n")}`;
  }

  const response = await callLLMWithRetry(`
너는 addressline1.com SEO 블로그 전략가다.

목표: "영문주소 변환", "address line 1", "해외직구 주소" 키워드 1위

이번 카테고리: ${targetCategory}

기존 글 (${existingSlugs.length}편): ${existingSlugs.join(", ") || "(없음)"}
${gscHint}

중복되지 않는 새 블로그 글 제목 1개만 제안해.
- 사람들이 실제 검색할 롱테일 키워드 포함
- 한국어, 30자 이내
- 제목만 한 줄로 출력
  `, { timeout: 30000 });

  return { title: response.trim().replace(/^["']+|["']+$/g, "").split("\n")[0], category: targetCategory };
}

async function writeBlogPost() {
  const existingSlugs = getExistingSlugs();
  const existingPosts = getExistingPostTitles();
  const gscReport = await fetchGSCReport().catch(() => null);
  const { title, category } = await pickTopic(existingSlugs, gscReport);

  console.log(`[blog-bot] Writing: "${title}" (${category})`);

  const slug = title.replace(/[^가-힣a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").toLowerCase().slice(0, 50);

  const internalLinksRef = existingPosts.length > 0
    ? `\n\n기존 글 중 관련 있으면 2~3개 링크 (마크다운: [텍스트](/blog/슬러그)):\n${existingPosts.slice(-15).map(p => `- "${p.title}" → /blog/${p.slug}`).join("\n")}`
    : "";

  const body = await callLLMWithRetry(`
너는 addressline1.com SEO 블로그 작가다.

제목: ${title}

규칙:
- 1500자 이상 한국어
- h2, h3 소제목 사용
- "영문주소", "Address Line", "해외직구", "해외배송" 키워드 자연스럽게 포함
- 실제로 유용한 정보 (뻔한 내용 금지)
- 마지막에 addressline1.com에서 영문주소를 변환하라는 자연스러운 CTA
- HTML 태그 없이 마크다운 (## / ###)
- 내부 링크는 마크다운: [텍스트](/blog/slug)
${internalLinksRef}

본문만 출력.
  `);

  const jsxBody = bodyToJSX(body);
  const pageContent = generatePageTsx(title, slug, category, jsxBody);
  const slugDir = join(BLOG_DIR, slug);
  mkdirSync(slugDir, { recursive: true });
  writeFileSync(join(slugDir, "page.tsx"), pageContent);

  updateSitemap(slug);

  console.log(`[blog-bot] Verifying build...`);
  try {
    execSync("npm run build", { cwd: PROJECT_DIR, timeout: 180000, stdio: "pipe", encoding: "utf-8" });
  } catch (buildErr) {
    const error = buildErr as Error & { stderr?: string };
    console.error(`[blog-bot] Build FAILED:`, error.stderr?.slice(0, 500));
    execSync("git checkout -- .", { cwd: PROJECT_DIR });
    if (existsSync(slugDir)) execSync(`rm -rf "${slugDir}"`);
    await sendTelegram(`❌ <b>빌드 실패</b>\n\n${title}\n${(error.stderr || error.message).slice(0, 200)}`);
    throw new Error(`Build failed: ${title}`);
  }

  const commitTitle = title.replace(/["\\`$]/g, "");
  execSync("git add -A", { cwd: PROJECT_DIR });
  execSync(`git commit -m "블로그 자동 생성: ${commitTitle}"`, { cwd: PROJECT_DIR });
  execSync("git push origin master", { cwd: PROJECT_DIR });

  console.log(`[blog-bot] Published: ${slug}`);
  await sendTelegram(`📝 <b>AddressLine1 블로그</b>\n\n${title}\nhttps://addressline1.com/blog/${slug}`);
}

async function refreshOldPost() {
  const posts = getExistingPostTitles();
  if (posts.length < 3) return;

  const refreshIndexFile = join(DATA_DIR, "refresh-index.txt");
  let refreshIndex = 0;
  if (existsSync(refreshIndexFile)) refreshIndex = parseInt(readFileSync(refreshIndexFile, "utf-8").trim(), 10) || 0;

  const targetIndex = refreshIndex % posts.length;
  const target = posts[targetIndex];
  const pagePath = join(BLOG_DIR, target.slug, "page.tsx");
  if (!existsSync(pagePath)) { writeFileSync(refreshIndexFile, String(targetIndex + 1)); return; }

  console.log(`[blog-bot] Refreshing: "${target.title}"`);

  const linksRef = posts.filter((p) => p.slug !== target.slug).slice(-10).map((p) => `- "${p.title}" → /blog/${p.slug}`).join("\n");

  const body = await callLLMWithRetry(`
너는 addressline1.com SEO 블로그 작가다. 기존 글을 완전히 새로 작성해.

제목: ${target.title}

규칙:
- 1500자 이상 한국어, h2/h3 소제목
- "영문주소", "Address Line", "해외직구" 키워드 포함
- 마지막에 addressline1.com CTA
- 마크다운, 내부 링크:
${linksRef}

본문만 출력.
  `);

  const jsxBody = bodyToJSX(body);
  writeFileSync(pagePath, generatePageTsx(target.title, target.slug, "refresh", jsxBody));

  try {
    execSync("npm run build", { cwd: PROJECT_DIR, timeout: 180000, stdio: "pipe", encoding: "utf-8" });
  } catch (buildErr) {
    const error = buildErr as Error & { stderr?: string };
    execSync("git checkout -- .", { cwd: PROJECT_DIR });
    await sendTelegram(`❌ <b>리프레시 빌드 실패</b>\n\n${target.title}`);
    writeFileSync(refreshIndexFile, String(targetIndex + 1));
    throw new Error(`Refresh build failed: ${target.title}`);
  }

  const commitTitle = target.title.replace(/["\\`$]/g, "");
  execSync("git add -A", { cwd: PROJECT_DIR });
  execSync(`git commit -m "블로그 리프레시: ${commitTitle}"`, { cwd: PROJECT_DIR });
  execSync("git push origin master", { cwd: PROJECT_DIR });

  writeFileSync(refreshIndexFile, String(targetIndex + 1));
  markRefresh();
  await sendTelegram(`🔄 <b>블로그 리프레시</b>\n\n${target.title}\nhttps://addressline1.com/blog/${target.slug}`);
}

// ─── JSX 변환 ───

function bodyToJSX(markdown: string): string {
  const lines = markdown.split("\n");
  const jsx: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("### ")) jsx.push(`            <h3>${esc(trimmed.slice(4))}</h3>`);
    else if (trimmed.startsWith("## ")) jsx.push(`            <h2>${esc(trimmed.slice(3))}</h2>`);
    else if (trimmed.startsWith("- ")) jsx.push(`            <li>${processLinks(esc(trimmed.slice(2)))}</li>`);
    else jsx.push(`            <p>${processLinks(esc(trimmed))}</p>`);
  }
  return jsx.join("\n");
}

function processLinks(text: string): string {
  return text.replace(
    /\[([^\]]+)\]\(\/(blog\/[^)]+)\)/g,
    '<Link href="/$2">$1</Link>'
  );
}

function esc(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function generatePageTsx(title: string, slug: string, category: string, jsxBody: string): string {
  const description = `${title}. addressline1.com에서 한글 주소를 영문으로 변환하세요.`;
  const date = new Date().toISOString().slice(0, 10);
  const shortCategory = category.split(/[\/,]/)[0].trim();

  return `import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '${title.replace(/'/g, "\\'")} | 영문주소 변환기',
  description: '${description.replace(/'/g, "\\'")}',
  keywords: ['영문주소', '${shortCategory.replace(/'/g, "\\'")}', 'Address Line', '해외직구', '해외배송', '영문주소 변환'],
  alternates: { canonical: 'https://addressline1.com/blog/${slug}' },
};

export default function BlogPost() {
  const articleData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '${title.replace(/'/g, "\\'")}',
    description: '${description.replace(/'/g, "\\'")}',
    datePublished: '${date}',
    author: { '@type': 'Organization', name: '영문주소 변환기' },
    publisher: { '@type': 'Organization', name: '영문주소 변환기', url: 'https://addressline1.com' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleData) }} />
      <div className="blog-article">
        <article>
          <time>${date}</time>
          <h1>${esc(title)}</h1>
          <div className="blog-article-body">
${jsxBody}
          </div>
          <div className="blog-article-footer">
            <Link href="/blog">← 블로그 목록</Link>
            <Link href="/">← 영문주소 변환기</Link>
          </div>
        </article>
      </div>
    </>
  );
}
`;
}

function updateSitemap(slug: string) {
  let content = readFileSync(SITEMAP_FILE, "utf-8");
  const newEntry = `    { url: 'https://addressline1.com/blog/${slug}', changeFrequency: 'monthly' as const, priority: 0.9 },`;

  if (content.includes("// BLOG_ENTRIES")) {
    content = content.replace("// BLOG_ENTRIES", `${newEntry}\n    // BLOG_ENTRIES`);
  } else {
    content = content.replace(
      "return [",
      `return [\n${newEntry}`
    );
  }
  writeFileSync(SITEMAP_FILE, content);
}

// ─── 주간 리뷰 ───

async function weeklyReview() {
  const now = new Date();
  if (now.getDay() !== 1) return;
  const reviewFile = join(DATA_DIR, "last-review.txt");
  const thisWeek = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + new Date(now.getFullYear(), 0, 1).getDay()) / 7)).padStart(2, "0")}`;
  if (existsSync(reviewFile) && readFileSync(reviewFile, "utf-8").trim() === thisWeek) return;

  const existingSlugs = getExistingSlugs();
  const gscReport = await fetchGSCReport().catch(() => null);
  const gscSummary = gscReport ? formatGSCReport(gscReport) : "(GSC 데이터 없음)";

  const review = await callLLMWithRetry(`
AddressLine1 SEO 주간 점검.

블로그 글 (${existingSlugs.length}편): ${existingSlugs.join(", ")}

GSC 28일 데이터:
${gscSummary}

분석:
1. 잘 되는 키워드 / 기회 키워드
2. 다음 주 글 3편 제안 (제목 + 타겟 키워드)
3. 기존 글 개선점
4. 전략 개선

300자 이내 간결하게.
  `);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(reviewFile, thisWeek);

  let msg = `📊 <b>AddressLine1 주간 SEO</b>\n\n${review}`;
  if (gscReport) msg += `\n\n📈 클릭 ${gscReport.totalClicks} | 노출 ${gscReport.totalImpressions} | 순위 ${gscReport.avgPosition.toFixed(1)}`;
  await sendTelegram(msg);
}

// ─── 메인 ───

async function main() {
  const isLoop = process.argv.includes("--loop");

  if (isLoop) {
    console.log(`[blog-bot] Starting loop mode`);
    mkdirSync(DATA_DIR, { recursive: true });

    while (!existsSync(STOP_FILE)) {
      try {
        execSync("git pull origin master 2>/dev/null || true", { cwd: PROJECT_DIR });
        if (shouldWrite()) { await writeBlogPost(); markRun(); }
        if (shouldRefresh()) { try { await refreshOldPost(); } catch (err) { console.error(`[blog-bot] Refresh error:`, err); } }
        await weeklyReview();
      } catch (err) { console.error(`[blog-bot] Error:`, err); }

      for (let i = 0; i < CHECK_INTERVAL_MS / 60000; i++) {
        if (existsSync(STOP_FILE)) break;
        await new Promise((r) => setTimeout(r, 60000));
      }
    }
    console.log("[blog-bot] Stopped");
  } else {
    if (shouldWrite()) { await writeBlogPost(); markRun(); } else { console.log("[blog-bot] Not yet time"); }
  }
}

main().catch(console.error);
