export interface ParsedTransaction {
  amount: number;
  type: "expense" | "income";
  category: string;
  notes: string;
  date: string; // YYYY-MM-DD
  accountHint?: string;
  confidence: number; // 0 - 1
  rawInput: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Food & Dining": [
    "makan",
    "kopi",
    "coffee",
    "cafe",
    "resto",
    "gofood",
    "grabfood",
    "nasi",
    "bakso",
    "soto",
    "mie",
    "ayam",
    "sarapan",
    "lunch",
    "dinner",
    "snack",
    "jajan",
    "minum",
    "boba",
  ],
  Transportation: [
    "bensin",
    "pertamax",
    "pertalite",
    "ojek",
    "gojek",
    "grab",
    "goride",
    "gocar",
    "tol",
    "parkir",
    "kereta",
    "krl",
    "mrt",
    "busway",
    "tije",
    "taxi",
    "tiket",
    "pesawat",
  ],
  Utilities: [
    "listrik",
    "pln",
    "token",
    "air",
    "pdam",
    "wifi",
    "indihome",
    "biznet",
    "firstmedia",
    "pulsa",
    "kuota",
    "telkomsel",
    "indosat",
    "xl",
  ],
  Entertainment: [
    "netflix",
    "spotify",
    "youtube",
    "disney",
    "bioskop",
    "cinema",
    "xxi",
    "game",
    "steam",
    "playstation",
    "nonton",
  ],
  Healthcare: [
    "obat",
    "apotek",
    "dokter",
    "klinik",
    "vitamin",
    "bpjs",
    "dental",
    "gigi",
    "rawat",
    "panadol",
  ],
  Shopping: [
    "shopee",
    "tokopedia",
    "lazada",
    "baju",
    "sepatu",
    "tas",
    "celana",
    "supermarket",
    "indomaret",
    "alfamart",
  ],
  Salary: ["gaji", "payroll", "salary", "bonus", "thr", "dividen", "fee", "proyek"],
};

const ACCOUNT_KEYWORDS = [
  "bca",
  "mandiri",
  "bni",
  "bri",
  "jago",
  "jenius",
  "seabank",
  "gopay",
  "ovo",
  "dana",
  "shopeepay",
  "cash",
  "tunai",
];

/**
 * Extracts numerical amount from natural phrases:
 * e.g. "25rb", "150k", "1.5jt", "1,5 juta", "25.000", "50000"
 */
function extractAmount(text: string): { amount: number; matchedToken?: string } {
  const clean = text.toLowerCase();

  // Pattern 1: Millions ("1.5jt", "2 jt", "1,5 juta", "3juta")
  const millionMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(",", "."));
    return { amount: Math.round(num * 1000000), matchedToken: millionMatch[0] };
  }

  // Pattern 2: Thousands ("25rb", "50k", "25 ribu", "100ribu")
  const thousandMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|k|ribu)\b/);
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(",", "."));
    return { amount: Math.round(num * 1000), matchedToken: thousandMatch[0] };
  }

  // Pattern 3: Formatted or plain currency ("Rp 25.000", "25.000", "50000")
  const standardMatch = clean.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,9})\b/);
  if (standardMatch) {
    const rawVal = standardMatch[1].replace(/\./g, "");
    const num = parseInt(rawVal, 10);
    if (!isNaN(num) && num > 0) {
      return { amount: num, matchedToken: standardMatch[0] };
    }
  }

  return { amount: 0 };
}

/**
 * Parses a natural language sentence into a structured financial transaction
 */
export function parseNaturalLanguageTransaction(
  input: string,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): ParsedTransaction {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Amount
  const { amount, matchedToken: amountToken } = extractAmount(lower);

  // 2. Type: income vs expense
  const isIncome = /\b(gaji|payroll|bonus|thr|dividen|pemasukan|terima|income)\b/.test(lower);
  const type = isIncome ? "income" : "expense";

  // 3. Category inference
  let category = isIncome ? "Salary" : "General";
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      category = catName;
      break;
    }
  }

  // 4. Account detection
  let accountHint: string | undefined;
  for (const acc of ACCOUNT_KEYWORDS) {
    if (new RegExp(`\\b${acc}\\b`).test(lower)) {
      accountHint = acc.toUpperCase();
      if (acc === "cash" || acc === "tunai") accountHint = "Cash";
      break;
    }
  }

  // 5. Date detection ("kemarin", "hari ini", or specific date)
  let date = referenceDate;
  if (lower.includes("kemarin") || lower.includes("yesterday")) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 1);
    date = d.toISOString().slice(0, 10);
  }

  // 6. Clean Title / Description
  let cleanNotes = trimmed;
  if (amountToken) {
    cleanNotes = cleanNotes.replace(new RegExp(amountToken, "i"), "");
  }
  if (accountHint) {
    cleanNotes = cleanNotes.replace(new RegExp(`\\b${accountHint}\\b`, "i"), "");
  }
  cleanNotes = cleanNotes
    .replace(/\b(kemarin|hari ini|bayar pakai|pakai|via|di)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // If notes ended up empty, fallback to category name
  if (!cleanNotes) {
    cleanNotes = category;
  }

  // Confidence calculation
  let confidence = 0.3;
  if (amount > 0) confidence += 0.4;
  if (category !== "General") confidence += 0.2;
  if (accountHint) confidence += 0.1;

  return {
    amount,
    type,
    category,
    notes: cleanNotes,
    date,
    accountHint,
    confidence: Math.min(1, confidence),
    rawInput: input,
  };
}
