import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { db } from "../lib/db";

interface SyncStatus {
  readonly pendingCount: number;
  readonly hasPending: boolean;
}

export const useSyncStatus = (): SyncStatus => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const subscription = liveQuery(() => db.sync_outbox.count()).subscribe({
      next: (count) => setPendingCount(count),
      error: (err) => console.error("[sync] liveQuery error:", err),
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    pendingCount,
    hasPending: pendingCount > 0,
  };
};
