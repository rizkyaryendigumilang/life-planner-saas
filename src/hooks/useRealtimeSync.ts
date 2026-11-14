import { useEffect, useRef } from "react";
import { pb } from "../lib/pocketbase";

type CollectionName =
  | "expenses"
  | "goals"
  | "bank_accounts"
  | "household_bills"
  | "investments"
  | "life_planner"
  | "pets"
  | "itineraries";

interface RealtimeEvent<T = any> {
  action: "create" | "update" | "delete";
  record: T;
  collection: string;
}

/**
 * React hook to listen for PocketBase realtime events and synchronize local view
 */
export function useRealtimeSync(
  collections: CollectionName[],
  onRecordChange?: (event: RealtimeEvent) => void,
  enabled: boolean = true
) {
  const handlerRef = useRef(onRecordChange);
  handlerRef.current = onRecordChange;

  useEffect(() => {
    if (!enabled || !pb.authStore.isValid) return;

    const unsubs: Array<() => void> = [];

    collections.forEach((colName) => {
      try {
        pb.collection(colName)
          .subscribe("*", (e: any) => {
            const eventPayload: RealtimeEvent = {
              action: e.action,
              record: e.record,
              collection: colName,
            };

            // Dispatch global window event for cross-component sync
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("life-planner:realtime-change", {
                  detail: eventPayload,
                })
              );
            }

            // Invoke local callback if provided
            if (handlerRef.current) {
              handlerRef.current(eventPayload);
            }
          })
          .then((unsub) => {
            unsubs.push(unsub);
          })
          .catch((err) => {
            console.warn(`[RealtimeSync] Could not subscribe to ${colName}:`, err);
          });
      } catch (err) {
        console.warn(`[RealtimeSync] Init error for ${colName}:`, err);
      }
    });

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // Cleanup error safe fallback
        }
      });
      // Fallback batch unsubscribe
      collections.forEach((colName) => {
        try {
          pb.collection(colName).unsubscribe("*");
        } catch {
          // Ignore
        }
      });
    };
  }, [collections.join(","), enabled]);
}
