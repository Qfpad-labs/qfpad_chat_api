import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import { basename, resolve } from "node:path";
import { config } from "../config.js";
import { closeDb, pool, replaceDocChunks, runMigrations, upsertDocSource } from "../db.js";
import { logger } from "../logger.js";

const MAX_PAGES_PER_RUN = 30;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const QPAD_SALE_PAGE_URL = "https://qfpad.xyz/projects/0xed11eF1cA37f12635ffF6ad6163486F884A521Ca";
const BUNDLED_GUIDES = [
  resolve(process.cwd(), "docs/support/qpad_buyer_quick_guide.md"),
  resolve(process.cwd(), "docs/support/qpad_fiesta_details.md"),
];

function chunkText(text: string, title: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: Array<{ chunkIndex: number; title: string; headingPath: string; chunkText: string }> = [];

  let cursor = 0;
  let chunkIndex = 0;
  while (cursor < normalized.length) {
    const slice = normalized.slice(cursor, cursor + CHUNK_SIZE).trim();
    if (slice) {
      chunks.push({
        chunkIndex,
        title,
        headingPath: title,
        chunkText: slice,
      });
      chunkIndex += 1;
    }
    cursor += Math.max(CHUNK_SIZE - CHUNK_OVERLAP, 1);
  }

  return chunks;
}

function normalizeUrl(baseUrl: string, url: string): string | null {
  try {
    const parsed = new URL(url, baseUrl);
    if (parsed.hostname !== new URL(baseUrl).hostname) return null;
    parsed.hash = "";
    parsed.search = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extractContent($: cheerio.CheerioAPI): { title: string; text: string } {
  const title = $("title").first().text().trim();

  $("script, style, nav, footer, header, noscript").remove();

  const mainText =
    $("main").text().trim() ||
    $("article").text().trim() ||
    $(".page-inner").text().trim() ||
    $(".markdown-section").text().trim() ||
    $("body").text().trim();

  const cleaned = mainText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();

  return { title: title || "Untitled", text: cleaned };
}

function discoverLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>();

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(baseUrl, href);
    if (normalized && normalized.startsWith(config.docsBaseUrl.replace(/\/$/, ""))) {
      links.add(normalized);
    }
  });

  return [...links];
}

async function getSyncedUrls(): Promise<Set<string>> {
  const result = await pool.query<{ source_url: string }>(
    `select source_url from chatbot.doc_sources`,
  );
  return new Set(result.rows.map((row) => row.source_url));
}

async function syncUrl(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "qfpad-chat-api/0.1 docs-sync" },
  });

  if (!response.ok) {
    logger.warn("Skipping URL fetch failure", { url, status: response.status });
    return;
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const { title, text } = extractContent($);

  if (!text || text.length < 50) {
    logger.warn("Skipping URL with too little text", { url });
    return;
  }

  const contentHash = createHash("sha256").update(text).digest("hex");
  const sourceId = await upsertDocSource({ sourceUrl: url, title, contentHash });
  await replaceDocChunks({ sourceId, chunks: chunkText(text, title) });

  logger.info("Synced doc page", { url, title });
}

function resolveLocalGuideMetadata(filePath: string) {
  const fileName = basename(filePath).toLowerCase();

  if (fileName === "qpad_buyer_quick_guide.txt") {
    return {
      sourceUrl: `${QPAD_SALE_PAGE_URL}#quick-buying-guide`,
      title: "QPAD Presale Quick Buying Guide",
    };
  }

  if (fileName === "qpad_fiesta_details.txt") {
    return {
      sourceUrl: `${QPAD_SALE_PAGE_URL}#qpad-fiesta`,
      title: "QPAD Fiesta Incentives",
    };
  }

  return {
    sourceUrl: `local-guide://${fileName}`,
    title: fileName,
  };
}

async function syncLocalGuide(filePath: string) {
  const text = (await readFile(filePath, "utf8")).trim();
  if (!text) {
    logger.warn("Skipping empty local guide", { filePath });
    return;
  }

  const metadata = resolveLocalGuideMetadata(filePath);
  const contentHash = createHash("sha256").update(text).digest("hex");
  const sourceId = await upsertDocSource({
    sourceUrl: metadata.sourceUrl,
    title: metadata.title,
    contentHash,
  });

  await replaceDocChunks({
    sourceId,
    chunks: chunkText(text, metadata.title),
  });

  logger.info("Synced local guide", { filePath, sourceUrl: metadata.sourceUrl });
}

async function getBundledGuidePaths() {
  const resolved: string[] = [];

  for (const filePath of BUNDLED_GUIDES) {
    try {
      await access(filePath);
      resolved.push(filePath);
    } catch {
      logger.warn("Bundled guide not found, skipping", { filePath });
    }
  }

  return resolved;
}

async function main() {
  await runMigrations();

  const seedUrls = config.docsSeedUrls.length > 0 ? config.docsSeedUrls : [config.docsBaseUrl];
  const synced = await getSyncedUrls();
  const toVisit: string[] = [];
  const visited = new Set<string>();

  for (const url of seedUrls) {
    if (!synced.has(url)) toVisit.push(url);
  }

  const discoverQueue: string[] = [...seedUrls];

  while (discoverQueue.length > 0 && toVisit.length + synced.size < MAX_PAGES_PER_RUN) {
    const current = discoverQueue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (!synced.has(current)) {
      toVisit.push(current);
    }

    try {
      const response = await fetch(current, {
        headers: { "user-agent": "qfpad-chat-api/0.1 docs-sync" },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);
      const links = discoverLinks($, current);

      for (const link of links) {
        if (!visited.has(link) && !synced.has(link)) {
          discoverQueue.push(link);
        }
      }
    } catch (error) {
      logger.warn("Failed to discover links from URL", { url: current });
    }
  }

  for (const url of toVisit) {
    await syncUrl(url);
  }

  for (const filePath of await getBundledGuidePaths()) {
    await syncLocalGuide(filePath);
  }

  logger.info("Docs sync complete", {
    synced: toVisit.length,
    totalSources: synced.size + toVisit.length,
  });
}

main()
  .catch((error) => {
    logger.error("Docs sync failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  })
  .finally(async () => { await closeDb(); });
