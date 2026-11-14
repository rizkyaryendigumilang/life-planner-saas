/**
 * RFC 4180 compliant CSV generator & exporter for Life Planner SaaS.
 * Features UTF-8 BOM for seamless Microsoft Excel & Apple Numbers compatibility.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (item: T, index: number) => unknown;
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  const BOM = "\uFEFF"; // UTF-8 Byte Order Mark for Excel
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(",");
  const rows = data.map((item, idx) =>
    columns.map((col) => escapeCsvCell(col.accessor(item, idx))).join(","),
  );
  return BOM + [headerRow, ...rows].join("\r\n");
}

export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =========================================================
   PRESET SERIALIZERS FOR FINANCIAL & PLANNER MODULES
========================================================= */

export function exportExpensesToCsv(records: any[], accountsMap: Map<string, string> = new Map()): string {
  const columns: CsvColumn<any>[] = [
    { header: "Tanggal", accessor: (r) => r.date || r.created?.slice(0, 10) || "" },
    { header: "Tipe", accessor: (r) => r.type || "Expense" },
    { header: "Kategori", accessor: (r) => r.category || "Uncategorized" },
    { header: "Jumlah (IDR)", accessor: (r) => Number(r.amount || 0) },
    { header: "Status Bayar", accessor: (r) => (r.paid ? "Lunas / Selesai" : "Pending") },
    { header: "Rekening / Akun", accessor: (r) => accountsMap.get(r.account) || r.account || "Default" },
    { header: "Catatan / Keterangan", accessor: (r) => r.notes || "" },
    { header: "ID Transaksi", accessor: (r) => r.id || "" },
  ];
  return generateCsv(records, columns);
}

export function exportHouseholdBillsToCsv(records: any[]): string {
  const columns: CsvColumn<any>[] = [
    { header: "Jatuh Tempo", accessor: (r) => r.due_date || r.date || "" },
    { header: "Nama Tagihan", accessor: (r) => r.name || r.title || "" },
    { header: "Kategori", accessor: (r) => r.category || "Rumah Tangga" },
    { header: "Subkategori", accessor: (r) => r.subcategory || "" },
    { header: "Jumlah (IDR)", accessor: (r) => Number(r.amount || 0) },
    { header: "Status", accessor: (r) => (r.paid ? "Lunas" : "Belum Dibayar") },
    { header: "Catatan", accessor: (r) => r.notes || "" },
  ];
  return generateCsv(records, columns);
}

export function exportBankAccountsToCsv(records: any[]): string {
  const columns: CsvColumn<any>[] = [
    { header: "Nama Bank / Institusi", accessor: (r) => r.bank_name || "" },
    { header: "Nama Pemilik", accessor: (r) => r.account_name || "" },
    { header: "Nomor Rekening", accessor: (r) => r.account_number || "" },
    { header: "Tipe Akun", accessor: (r) => r.account_type || "" },
    { header: "Saldo Saat Ini (IDR)", accessor: (r) => Number(r.balance || 0) },
    { header: "Status", accessor: (r) => r.status || "active" },
    { header: "Catatan", accessor: (r) => r.notes || "" },
  ];
  return generateCsv(records, columns);
}

export function exportInvestmentsToCsv(records: any[]): string {
  const columns: CsvColumn<any>[] = [
    { header: "Kode / Simbol", accessor: (r) => r.symbol || "" },
    { header: "Nama Aset", accessor: (r) => r.name || "" },
    { header: "Tipe Aset", accessor: (r) => r.type || "Stock" },
    { header: "Jumlah Unit / Lembar", accessor: (r) => Number(r.shares || r.units || 0) },
    { header: "Harga Beli Rata-rata", accessor: (r) => Number(r.buy_price || 0) },
    { header: "Nilai Total Investasi", accessor: (r) => Number(r.total_value || (Number(r.shares || 0) * Number(r.buy_price || 0))) },
    { header: "Catatan", accessor: (r) => r.notes || "" },
  ];
  return generateCsv(records, columns);
}

export function exportGoalsToCsv(records: any[]): string {
  const columns: CsvColumn<any>[] = [
    { header: "Nama Target Impian", accessor: (r) => r.name || "" },
    { header: "Kategori", accessor: (r) => r.category || "Financial" },
    { header: "Target Dana (IDR)", accessor: (r) => Number(r.target_amount || 0) },
    { header: "Dana Terkumpul (IDR)", accessor: (r) => Number(r.current_amount || 0) },
    {
      header: "Progres (%)",
      accessor: (r) => {
        const target = Number(r.target_amount || 0);
        const current = Number(r.current_amount || 0);
        return target > 0 ? Math.round((current / target) * 100) : 0;
      },
    },
    { header: "Target Tanggal Selesai", accessor: (r) => r.target_date || "" },
    { header: "Prioritas", accessor: (r) => r.priority || "Medium" },
    { header: "Status", accessor: (r) => r.status || "Active" },
    { header: "Catatan", accessor: (r) => r.notes || "" },
  ];
  return generateCsv(records, columns);
}

export function exportTasksToCsv(records: any[]): string {
  const columns: CsvColumn<any>[] = [
    { header: "Judul Agenda / Tugas", accessor: (r) => r.title || "" },
    { header: "Kategori", accessor: (r) => r.category || "General" },
    { header: "Prioritas", accessor: (r) => r.priority || "Medium" },
    { header: "Jatuh Tempo", accessor: (r) => r.due_date || "" },
    { header: "Status", accessor: (r) => r.status || "Pending" },
    { header: "Keterangan", accessor: (r) => r.description || "" },
  ];
  return generateCsv(records, columns);
}

/**
 * Generates a consolidated financial ledger CSV containing:
 * - Bank Accounts & Balances
 * - Cashflow Summary
 * - Transactions
 * - Household Bills
 */
export function exportConsolidatedFinancialCsv(bundle: {
  expenses?: any[];
  household_bills?: any[];
  bank_accounts?: any[];
  investments?: any[];
  goals?: any[];
}): string {
  const lines: string[] = ["\uFEFF=== LIFE PLANNER - BUKU KAS & KEUANGAN TERPADU ==="];
  lines.push(`Tanggal Export: ${new Date().toLocaleString("id-ID")}\r\n`);

  // 1. REKENING & SALDO
  if (bundle.bank_accounts && bundle.bank_accounts.length > 0) {
    lines.push("--- DAFTAR REKENING & SALDO AKTIF ---");
    lines.push(exportBankAccountsToCsv(bundle.bank_accounts));
    lines.push("\r\n");
  }

  // 2. TAGIHAN RUMAH TANGGA
  if (bundle.household_bills && bundle.household_bills.length > 0) {
    lines.push("--- TAGIHAN & PENGELUARAN RUMAH TANGGA ---");
    lines.push(exportHouseholdBillsToCsv(bundle.household_bills));
    lines.push("\r\n");
  }

  // 3. TRANSAKSI PENGELUARAN & PEMASUKAN
  if (bundle.expenses && bundle.expenses.length > 0) {
    lines.push("--- RIWAYAT TRANSAKSI KEUANGAN ---");
    lines.push(exportExpensesToCsv(bundle.expenses));
    lines.push("\r\n");
  }

  // 4. INVESTASI
  if (bundle.investments && bundle.investments.length > 0) {
    lines.push("--- PORTOFOLIO INVESTASI ---");
    lines.push(exportInvestmentsToCsv(bundle.investments));
    lines.push("\r\n");
  }

  // 5. TARGET KEUANGAN
  if (bundle.goals && bundle.goals.length > 0) {
    lines.push("--- TARGET FINANSIAL & TABUNGAN ---");
    lines.push(exportGoalsToCsv(bundle.goals));
    lines.push("\r\n");
  }

  return lines.join("\r\n");
}
