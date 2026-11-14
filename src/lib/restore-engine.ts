import { pb } from "./pocketbase";

export const OWNED_COLLECTIONS = [
  "expenses",
  "goals",
  "life_planner",
  "pets",
  "itineraries",
  "travel_trips",
  "bank_accounts",
  "goal_contributions",
  "experience_expenses",
  "experiences",
  "itinerary_items",
  "market_watchlist",
  "expense_ingestions",
  "investments",
  "household_bills",
] as const;

export type OwnedCollection = (typeof OWNED_COLLECTIONS)[number];
export type ImportSourceType = "json_backup" | "csv_expenses" | "csv_household";
export type ConflictStrategy = "merge" | "skip_existing" | "replace";

export interface ImportPreview {
  valid: boolean;
  sourceType: ImportSourceType;
  totalRecords: number;
  collections: Record<string, { count: number; sample: any[] }>;
  errors: string[];
  warnings: string[];
  metadata?: {
    app?: string;
    version?: number;
    exportedAt?: string;
    accountEmail?: string;
  };
}

export interface ImportResult {
  success: boolean;
  totalImported: number;
  totalSkipped: number;
  totalFailed: number;
  collectionResults: Record<string, { imported: number; skipped: number; failed: number }>;
  errors: string[];
}

/**
 * Validates and parses a Life Planner JSON backup bundle
 */
export function parseBackupJson(rawJson: string): {
  valid: boolean;
  data?: Record<string, any[]>;
  meta?: any;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "File bukan merupakan format JSON yang valid." };
    }

    // Check for standard Life Planner export format
    if (parsed.app && parsed.app !== "life-planner") {
      return {
        valid: false,
        error: `Format cadangan tidak dikenali (app: ${parsed.app}). Hanya cadangan dari Life Planner yang didukung.`,
      };
    }

    const data: Record<string, any[]> = {};
    const sourceData = parsed.data || parsed;

    for (const col of OWNED_COLLECTIONS) {
      if (Array.isArray(sourceData[col])) {
        data[col] = sourceData[col];
      }
    }

    // Check if at least one valid collection exists
    const hasData = Object.keys(data).some((k) => data[k].length > 0);
    if (!hasData) {
      return {
        valid: false,
        error: "Tidak ditemukan data koleksi yang valid dalam file cadangan JSON ini.",
      };
    }

    return {
      valid: true,
      data,
      meta: {
        app: parsed.app || "life-planner",
        version: parsed.version || 1,
        exportedAt: parsed.exportedAt,
        accountEmail: parsed.account?.email,
      },
    };
  } catch (err: any) {
    return { valid: false, error: `Gagal membaca file JSON: ${err.message}` };
  }
}

/**
 * Parses simple CSV content into expense records
 */
export function parseExpensesCsv(rawCsv: string): {
  valid: boolean;
  records: any[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { valid: false, records: [], errors: ["File CSV kosong atau tidak memiliki baris data."] };
  }

  // Header inspection
  const headerLine = lines[0].replace(/^\uFEFF/, ""); // Strip BOM
  const headers = headerLine.split(",").map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  // Look for standard headers: Tanggal, Tipe, Kategori, Jumlah/Nominal, Deskripsi/Catatan
  const dateIdx = headers.findIndex((h) => h.includes("tanggal") || h.includes("date"));
  const typeIdx = headers.findIndex((h) => h.includes("tipe") || h.includes("type"));
  const catIdx = headers.findIndex((h) => h.includes("kategori") || h.includes("category"));
  const amountIdx = headers.findIndex((h) => h.includes("jumlah") || h.includes("nominal") || h.includes("amount"));
  const descIdx = headers.findIndex((h) => h.includes("catatan") || h.includes("deskripsi") || h.includes("notes") || h.includes("description") || h.includes("title"));

  if (amountIdx === -1) {
    return {
      valid: false,
      records: [],
      errors: ["Kolom Jumlah / Nominal (amount) tidak ditemukan dalam header CSV."],
    };
  }

  const records: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parser handling quotes
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    cols.push(cur.trim());

    const cleanAmount = (cols[amountIdx] || "").replace(/[^0-9.-]+/g, "");
    const amount = parseFloat(cleanAmount);
    if (isNaN(amount) || amount <= 0) continue;

    const rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx].replace(/["']/g, "") : new Date().toISOString().slice(0, 10);
    const rawType = typeIdx >= 0 && cols[typeIdx] ? cols[typeIdx].toLowerCase() : "expense";
    const type = rawType.includes("pemasukan") || rawType.includes("income") ? "income" : "expense";
    const category = catIdx >= 0 && cols[catIdx] ? cols[catIdx].replace(/["']/g, "") : "General";
    const notes = descIdx >= 0 && cols[descIdx] ? cols[descIdx].replace(/["']/g, "") : "Imported from CSV";

    records.push({
      date: rawDate.slice(0, 10),
      type,
      amount,
      category,
      notes,
    });
  }

  return {
    valid: records.length > 0,
    records,
    errors: records.length === 0 ? ["Tidak ada transaksi valid yang dapat diparsing."] : errors,
  };
}

/**
 * Builds an inspection preview before executing import
 */
export function generateImportPreview(
  parsedData: Record<string, any[]>,
  sourceType: ImportSourceType = "json_backup",
  meta?: any,
): ImportPreview {
  const collections: Record<string, { count: number; sample: any[] }> = {};
  let totalRecords = 0;
  const warnings: string[] = [];

  for (const [col, items] of Object.entries(parsedData)) {
    if (Array.isArray(items) && items.length > 0) {
      collections[col] = {
        count: items.length,
        sample: items.slice(0, 2),
      };
      totalRecords += items.length;
    }
  }

  if (totalRecords === 0) {
    warnings.push("Tidak ada catatan yang akan diimpor.");
  }

  return {
    valid: totalRecords > 0,
    sourceType,
    totalRecords,
    collections,
    errors: [],
    warnings,
    metadata: meta,
  };
}

/**
 * Executes the database restore with strict tenant isolation
 */
export async function executeRestore(
  user: { id: string; email?: string },
  parsedData: Record<string, any[]>,
  strategy: ConflictStrategy = "merge",
  onProgress?: (progress: { percent: number; collection: string; current: number; total: number }) => void,
  customPbClient?: any,
): Promise<ImportResult> {
  if (!user?.id) {
    throw new Error("Pengguna tidak terotentikasi. Restore dibatalkan demi keamanan.");
  }

  const client = customPbClient || pb;
  const result: ImportResult = {
    success: true,
    totalImported: 0,
    totalSkipped: 0,
    totalFailed: 0,
    collectionResults: {},
    errors: [],
  };

  const validEntries = Object.entries(parsedData).filter(
    ([col, items]) => OWNED_COLLECTIONS.includes(col as any) && Array.isArray(items) && items.length > 0,
  );

  let grandTotal = validEntries.reduce((acc, [, items]) => acc + items.length, 0);
  if (grandTotal === 0) grandTotal = 1;
  let overallProcessed = 0;

  for (const [colName, records] of validEntries) {
    const colSummary = { imported: 0, skipped: 0, failed: 0 };
    result.collectionResults[colName] = colSummary;

    // Fetch existing records for this user to check duplicates if strategy is merge or skip
    let existingIds = new Set<string>();
    if (strategy === "merge" || strategy === "skip_existing") {
      try {
        const existing = await client.collection(colName).getFullList({ fields: "id", filter: `user = "${user.id}"` });
        existingIds = new Set(existing.map((e: any) => e.id));
      } catch {
        // collection might not support getFullList or filter, continue safely
      }
    }

    for (let i = 0; i < records.length; i++) {
      const rawRecord = records[i];
      overallProcessed++;

      if (onProgress) {
        onProgress({
          percent: Math.min(100, Math.round((overallProcessed / grandTotal) * 100)),
          collection: colName,
          current: i + 1,
          total: records.length,
        });
      }

      // Prepare payload: ALWAYS enforce active user's ID
      const payload: Record<string, any> = { ...rawRecord };

      // CRITICAL SECURITY ENFORCEMENT: Never allow foreign user ID injection
      payload.user = user.id;

      // Clean PocketBase system fields from payload
      delete payload.collectionId;
      delete payload.collectionName;
      delete payload.created;
      delete payload.updated;
      delete payload.expand;

      const recordId = rawRecord.id;

      if (recordId && existingIds.has(recordId)) {
        if (strategy === "skip_existing") {
          colSummary.skipped++;
          result.totalSkipped++;
          continue;
        }

        if (strategy === "merge") {
          // Update existing record
          try {
            delete payload.id;
            await client.collection(colName).update(recordId, payload);
            colSummary.imported++;
            result.totalImported++;
          } catch (err: any) {
            colSummary.failed++;
            result.totalFailed++;
            result.errors.push(`[${colName}] Gagal update ID ${recordId}: ${err.message}`);
          }
          continue;
        }
      }

      // If record is new or replace mode
      try {
        // Strip existing ID to allow PB to assign a fresh valid ID and avoid duplicate key constraint errors
        delete payload.id;
        await client.collection(colName).create(payload);
        colSummary.imported++;
        result.totalImported++;
      } catch (err: any) {
        colSummary.failed++;
        result.totalFailed++;
        result.errors.push(`[${colName}] Gagal buat entri #${i + 1}: ${err.message}`);
      }
    }
  }

  // Trigger app notification that data was updated
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("life-planner:data-restored", {
        detail: { result, timestamp: new Date().toISOString() },
      }),
    );
  }

  result.success = result.totalFailed === 0 || result.totalImported > 0;
  return result;
}
