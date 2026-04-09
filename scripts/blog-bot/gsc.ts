import { google, searchconsole_v1 } from "googleapis";
import { existsSync, readFileSync } from "fs";

const SITE_URL = "https://addressline1.com";

export interface GSCPerformanceRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCReport {
  topQueries: GSCPerformanceRow[];
  underperforming: GSCPerformanceRow[];
  lowCTR: GSCPerformanceRow[];
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
}

function getAuth() {
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (keyPath && existsSync(keyPath)) {
    const key = JSON.parse(readFileSync(keyPath, "utf-8"));
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
  }
  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  const privateKey = process.env.GSC_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, "\n") },
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
  }
  return null;
}

export async function fetchGSCReport(days = 28): Promise<GSCReport | null> {
  const auth = getAuth();
  if (!auth) { console.log("[gsc] No credentials configured, skipping"); return null; }

  const searchconsole = google.searchconsole({ version: "v1", auth });
  const endDate = new Date(); endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: { startDate: fmt(startDate), endDate: fmt(endDate), dimensions: ["query", "page"], rowLimit: 100 },
    });

    const rows: GSCPerformanceRow[] = (res.data.rows || []).map((row: searchconsole_v1.Schema$ApiDataRow) => ({
      query: row.keys?.[0] || "", page: row.keys?.[1] || "",
      clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, position: row.position || 0,
    }));

    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const avgPosition = rows.length > 0 ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(totalImpressions, 1) : 0;

    return {
      topQueries: [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 20),
      underperforming: rows.filter((r) => r.impressions >= 5 && r.position > 10).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
      lowCTR: rows.filter((r) => r.impressions >= 10 && r.ctr < 0.02).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
      totalClicks, totalImpressions, avgPosition,
    };
  } catch (err) { console.error("[gsc] API error:", (err as Error).message); return null; }
}

export function formatGSCReport(report: GSCReport): string {
  const lines: string[] = [];
  lines.push(`총 클릭: ${report.totalClicks}, 총 노출: ${report.totalImpressions}, 평균 순위: ${report.avgPosition.toFixed(1)}`);
  if (report.topQueries.length > 0) {
    lines.push("\n[상위 쿼리]");
    for (const q of report.topQueries.slice(0, 10)) lines.push(`- "${q.query}" → 클릭 ${q.clicks}, 노출 ${q.impressions}, 순위 ${q.position.toFixed(1)}`);
  }
  if (report.underperforming.length > 0) {
    lines.push("\n[순위 개선 필요]");
    for (const q of report.underperforming.slice(0, 5)) lines.push(`- "${q.query}" → 노출 ${q.impressions}, 순위 ${q.position.toFixed(1)}`);
  }
  if (report.lowCTR.length > 0) {
    lines.push("\n[CTR 개선 필요]");
    for (const q of report.lowCTR.slice(0, 5)) lines.push(`- "${q.query}" → 노출 ${q.impressions}, CTR ${(q.ctr * 100).toFixed(1)}%`);
  }
  return lines.join("\n");
}
