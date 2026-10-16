import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Investment, InvestmentMode, AssetType } from "../types";
import { Button, Dialog, Input, Label, Select, SelectItem } from "./ui";

export default function InvestmentDialog({ open, onOpenChange, investment, onSave }: {
  open: boolean; onOpenChange: (value: boolean) => void; investment: Investment | null; onSave: (data: Partial<Investment>, id?: string) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<InvestmentMode>("Portfolio");
  const [assetType, setAssetType] = useState<AssetType>("Stock");
  const [symbol, setSymbol] = useState(""); const [name, setName] = useState(""); const [quantity, setQuantity] = useState("0"); const [averagePrice, setAveragePrice] = useState("0"); const [busy, setBusy] = useState(false);
  useEffect(() => {
    setMode(investment?.mode || "Portfolio"); setAssetType(investment?.asset_type || "Stock"); setSymbol(investment?.symbol || ""); setName(investment?.asset_name || ""); setQuantity(String(investment?.quantity ?? 0)); setAveragePrice(String(investment?.average_price ?? 0));
  }, [investment, open]);
  async function submit(e: FormEvent) { e.preventDefault(); if (!symbol.trim() || !name.trim()) return toast.error("Enter both symbol and asset name."); setBusy(true); try { await onSave({ mode, asset_type: assetType, symbol: symbol.trim().toUpperCase(), asset_name: name.trim(), quantity: Math.max(0, Number(quantity) || 0), average_price: Math.max(0, Number(averagePrice) || 0) }, investment?.id); onOpenChange(false); } catch { toast.error("Could not save this asset."); } finally { setBusy(false); } }
  return <Dialog open={open} onOpenChange={onOpenChange} title={investment ? "Edit asset" : "Add asset"} description="Track your position or keep an eye on an asset without adding it to your portfolio.">
    <form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label>List</Label><Select value={mode} onValueChange={(v) => setMode(v as InvestmentMode)}><SelectItem value="Portfolio">Portfolio</SelectItem><SelectItem value="Watchlist">Watchlist</SelectItem></Select></div><div><Label>Asset type</Label><Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}><SelectItem value="Stock">Stock</SelectItem><SelectItem value="Crypto">Crypto</SelectItem></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Symbol</Label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BBCA / BTC" required/></div><div><Label>Asset name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bank Central Asia" required/></div></div>{mode === "Portfolio" && <div className="grid gap-4 sm:grid-cols-2"><div><Label>Quantity</Label><Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required/></div><div><Label>Average purchase price</Label><Input type="number" min="0" step="any" value={averagePrice} onChange={(e) => setAveragePrice(e.target.value)} required/></div></div>}<div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save asset"}</Button></div></form>
  </Dialog>;
}
