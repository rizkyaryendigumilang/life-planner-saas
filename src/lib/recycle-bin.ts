import { pb } from "./pocketbase";

export type TrashedItem = {
  id: string;
  originalId: string;
  collection: string;
  typeLabel: string;
  title: string;
  subtitle?: string;
  amount?: number;
  data: Record<string, any>;
  deletedAt: string;
  userId: string;
};

function getStorageKey(userId?: string) {
  const uid = userId || pb.authStore.record?.id || "guest";
  return `lp_recycle_bin_${uid}`;
}

export const recycleBin = {
  list(userId?: string): TrashedItem[] {
    try {
      const key = getStorageKey(userId);
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const items: TrashedItem[] = JSON.parse(raw);
      // Auto-purge items older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const validItems = items.filter(
        (item) => new Date(item.deletedAt).getTime() > thirtyDaysAgo
      );
      if (validItems.length !== items.length) {
        localStorage.setItem(key, JSON.stringify(validItems));
      }
      return validItems.sort(
        (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      );
    } catch {
      return [];
    }
  },

  async trash(
    collection: string,
    record: Record<string, any>,
    meta: {
      typeLabel: string;
      title: string;
      subtitle?: string;
      amount?: number;
    }
  ): Promise<TrashedItem> {
    const userId = pb.authStore.record?.id || record.user || "guest";
    const key = getStorageKey(userId);

    // Prepare payload data for restoration (strip auto-generated PB fields)
    const restoreData: Record<string, any> = { ...record };
    delete restoreData.id;
    delete restoreData.created;
    delete restoreData.updated;
    delete restoreData.expand;

    const trashedItem: TrashedItem = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      originalId: record.id,
      collection,
      typeLabel: meta.typeLabel,
      title: meta.title,
      subtitle: meta.subtitle,
      amount: meta.amount,
      data: restoreData,
      deletedAt: new Date().toISOString(),
      userId,
    };

    // 1. Delete from PocketBase
    await pb.collection(collection).delete(record.id);

    // 2. Save into Recycle Bin storage
    const current = this.list(userId);
    const updated = [trashedItem, ...current];
    localStorage.setItem(key, JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent("life-planner:recycle-bin-updated"));
    return trashedItem;
  },

  async restore(trashedId: string): Promise<boolean> {
    const userId = pb.authStore.record?.id || "guest";
    const key = getStorageKey(userId);
    const current = this.list(userId);
    const target = current.find((item) => item.id === trashedId);

    if (!target) return false;

    try {
      // Re-create the item in its original collection
      await pb.collection(target.collection).create(target.data);

      // Remove from Recycle Bin
      const remaining = current.filter((item) => item.id !== trashedId);
      localStorage.setItem(key, JSON.stringify(remaining));

      window.dispatchEvent(new CustomEvent("life-planner:recycle-bin-updated"));
      // Notify page data reload if needed
      window.dispatchEvent(
        new CustomEvent("life-planner:data-restored", { detail: { collection: target.collection } })
      );
      return true;
    } catch (err) {
      console.error("Failed to restore item from recycle bin:", err);
      throw err;
    }
  },

  permanentlyDelete(trashedId: string): void {
    const userId = pb.authStore.record?.id || "guest";
    const key = getStorageKey(userId);
    const current = this.list(userId);
    const remaining = current.filter((item) => item.id !== trashedId);
    localStorage.setItem(key, JSON.stringify(remaining));
    window.dispatchEvent(new CustomEvent("life-planner:recycle-bin-updated"));
  },

  emptyBin(userId?: string): void {
    const uid = userId || pb.authStore.record?.id || "guest";
    const key = getStorageKey(uid);
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent("life-planner:recycle-bin-updated"));
  },
};
