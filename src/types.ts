export type Role = "superadmin" | "customer";

export type TaskStatus =
  | "Inbox"
  | "To-Do"
  | "In Progress"
  | "Done";

export type Priority = "Low" | "Medium" | "High";

export type ExpenseType = "Income" | "Expense";

export type Task = {
  id: string;
  user: string;
  title: string;
  description?: string;
  due_date?: string;
  status: TaskStatus;
  priority: Priority;
  category?: string;
  order: number;
  completed?: boolean;
  list?: string;
  tags?: string;
  recurrence?: string;
  remind_at?: string;
  parent_task?: string;
};

export type Expense = {
  id: string;
  user: string;
  date: string;
  amount: number;
  category: string;
  type: ExpenseType;
  notes?: string;
  due_date?: string;
  paid?: boolean;
  pet?: string;
  account?: string;
};

export type Trip = {
  id: string;
  user: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  actual: number;
  notes?: string;
};

export type Itinerary = {
  id: string;
  trip: string;
  date: string;
  start_time: string;
  end_time?: string;
  title: string;
  location?: string;
  notes?: string;
};

export type Goal = {
  id: string;
  user: string;
  title: string;
  why?: string;
  progress: number;
  due_date?: string;
};

export type PetSpecies =
  | "Dog"
  | "Cat"
  | "Bird"
  | "Fish"
  | "Rabbit"
  | "Other";

export type Pet = {
  id: string;
  user: string;
  name: string;
  species: PetSpecies;
  breed?: string;
  sex?: string;
  birth_date?: string;
  photo?: string;
  notes?: string;
};

export type BankAccount = {
  id: string;
  user: string;
  bank_name: string;
  account_name: string;
  account_number?: string;
  account_type: "Savings" | "Current" | "E-Wallet" | "Other";
  balance: number;
  status: "Active" | "Inactive";
  notes?: string;
  created?: string;
  updated?: string;
};

/* =========================================================
   PORTFOLIO
   ========================================================= */

export type InvestmentMode =
  | "Portfolio"
  | "Watchlist";

export type AssetType =
  | "Stock"
  | "Crypto";

export type Investment = {
  id: string;
  user: string;
  mode: InvestmentMode;
  asset_type: AssetType;
  symbol: string;
  asset_name: string;
  quantity: number;
  average_price: number;
  created?: string;
  updated?: string;
};

export type MarketQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  currency: string;
  marketStatus:
    | "live"
    | "eod"
    | "unavailable";
  source: string;
  updatedAt: string | null;
  message?: string;
};

/* =========================================================
   MARKET MONITOR
   ========================================================= */

export type MarketAssetType =
  | "Stock"
  | "Crypto"
  | "Gold"
  | "Currency";

export type MarketWatchlistItem = {
  id: string;
  user: string;
  asset_type: MarketAssetType;
  symbol: string;
  name: string;
  exchange?: string;
  currency?: string;
  sort_order?: number;
  is_active: boolean;
};
