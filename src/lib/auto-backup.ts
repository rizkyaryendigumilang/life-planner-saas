import { pb } from "./pocketbase";
import {
  downloadCsvFile,
  exportBankAccountsToCsv,
  exportConsolidatedFinancialCsv,
  exportExpensesToCsv,
  exportGoalsToCsv,
  exportHouseholdBillsToCsv,
  exportInvestmentsToCsv,
  exportTasksToCsv,
} from "./csv-export";

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

export interface AutoBackupMeta {
  lastSyncedAt: string;
  totalRecords: number;
  summary: Record<string, number>;
  app: string;
  version: number;
  userId: string;
}

export interface BackupBundle {
  app: string;
  version: number;
  exportedAt: string;
  account: {
    id: string;
    email?: string;
    name?: string;
  };
  summary: Record<string, number>;
  data: Record<string, any[]>;
  notes: string[];
}

const META_KEY_PREFIX = "lp_autobackup_meta_";
const DATA_KEY_PREFIX = "lp_autobackup_data_";

// Memory cache fallback in case localStorage has quota restrictions
const memorySnapshotCache = new Map<string, { meta: AutoBackupMeta; data: Record<string, any[]> }>();

let inFlightSyncPromise: Promise<any> | null = null;

export const autoBackup = {
  getMeta(userId?: string): AutoBackupMeta | null {
    if (!userId) return null;
    const mem = memorySnapshotCache.get(userId);
    if (mem?.meta) return mem.meta;

    try {
      const raw = localStorage.getItem(`${META_KEY_PREFIX}${userId}`);
      if (!raw) return null;
      return JSON.parse(raw) as AutoBackupMeta;
    } catch {
      return null;
    }
  },

  getData(userId?: string): Record<string, any[]> | null {
    if (!userId) return null;
    const mem = memorySnapshotCache.get(userId);
    if (mem?.data) return mem.data;

    try {
      const raw = localStorage.getItem(`${DATA_KEY_PREFIX}${userId}`);
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, any[]>;
    } catch {
      return null;
    }
  },

  async syncNow(user: { id: string; email?: string; name?: string }): Promise<{
    meta: AutoBackupMeta;
    data: Record<string, any[]>;
  }> {
    if (!user?.id) throw new Error("Pengguna belum login.");

    if (inFlightSyncPromise) {
      return inFlightSyncPromise;
    }

    inFlightSyncPromise = (async () => {
      try {
        const data: Record<string, any[]> = {};
        const summary: Record<string, number> = {};
        const notes: string[] = [];
        let totalRecords = 0;

        for (const collection of OWNED_COLLECTIONS) {
          try {
            const records = await pb.collection(collection).getFullList({ sort: "created" });
            data[collection] = records;
            summary[collection] = records.length;
            totalRecords += records.length;
          } catch {
            data[collection] = [];
            summary[collection] = 0;
            notes.push(`Koleksi '${collection}' tidak dapat dimuat.`);
          }
        }

        const meta: AutoBackupMeta = {
          app: "life-planner",
          version: 1,
          lastSyncedAt: new Date().toISOString(),
          totalRecords,
          summary,
          userId: user.id,
        };

        // Cache in memory
        memorySnapshotCache.set(user.id, { meta, data });

        // Persist to local storage
        try {
          localStorage.setItem(`${META_KEY_PREFIX}${user.id}`, JSON.stringify(meta));
          localStorage.setItem(`${DATA_KEY_PREFIX}${user.id}`, JSON.stringify(data));
        } catch (storageError) {
          console.warn("Storage quota exceeded for offline snapshot, keeping in memory cache:", storageError);
        }

        // Notify app
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("life-planner:auto-backup-synced", {
              detail: { meta, timestamp: meta.lastSyncedAt },
            }),
          );
        }

        return { meta, data };
      } finally {
        inFlightSyncPromise = null;
      }
    })();

    return inFlightSyncPromise;
  },

  /**
   * Triggers download of the latest snapshot as JSON bundle
   */
  downloadJson(user: { id: string; email?: string; name?: string }, explicitData?: Record<string, any[]>): void {
    const data = explicitData || this.getData(user.id) || {};
    const meta = this.getMeta(user.id);

    const bundle: BackupBundle = {
      app: "life-planner",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      summary: meta?.summary || {},
      data,
      notes: [],
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-planner-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Triggers download of financial data as Consolidated CSV
   */
  downloadConsolidatedCsv(userId: string): void {
    const data = this.getData(userId) || {};
    const csvContent = exportConsolidatedFinancialCsv({
      expenses: data.expenses,
      household_bills: data.household_bills,
      bank_accounts: data.bank_accounts,
      investments: data.investments,
      goals: data.goals,
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsvFile(csvContent, `life-planner-buku-kas-${dateStr}.csv`);
  },

  /**
   * Triggers download of a specific module as CSV
   */
  downloadModuleCsv(module: "expenses" | "household_bills" | "bank_accounts" | "investments" | "goals" | "tasks", userId: string): void {
    const data = this.getData(userId) || {};
    const dateStr = new Date().toISOString().slice(0, 10);

    let csvContent = "";
    let filename = "";

    switch (module) {
      case "expenses": {
        const accounts = (data.bank_accounts || []) as any[];
        const accountsMap = new Map<string, string>(accounts.map((a) => [a.id, a.bank_name ? `${a.bank_name} (${a.account_name})` : a.account_name]));
        csvContent = exportExpensesToCsv(data.expenses || [], accountsMap);
        filename = `life-planner-transaksi-${dateStr}.csv`;
        break;
      }
      case "household_bills": {
        csvContent = exportHouseholdBillsToCsv(data.household_bills || []);
        filename = `life-planner-tagihan-rumah-tangga-${dateStr}.csv`;
        break;
      }
      case "bank_accounts": {
        csvContent = exportBankAccountsToCsv(data.bank_accounts || []);
        filename = `life-planner-rekening-bank-${dateStr}.csv`;
        break;
      }
      case "investments": {
        csvContent = exportInvestmentsToCsv(data.investments || []);
        filename = `life-planner-investasi-${dateStr}.csv`;
        break;
      }
      case "goals": {
        csvContent = exportGoalsToCsv(data.goals || []);
        filename = `life-planner-target-impian-${dateStr}.csv`;
        break;
      }
      case "tasks": {
        csvContent = exportTasksToCsv(data.life_planner || []);
        filename = `life-planner-agenda-tugas-${dateStr}.csv`;
        break;
      }
    }

    if (csvContent) {
      downloadCsvFile(csvContent, filename);
    }
  },
};
