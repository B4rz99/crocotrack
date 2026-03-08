import { useCallback, useEffect, useState } from "react";
import { APP_CONFIG } from "../constants/config";
import { getPendingCount } from "../lib/sync";

interface SyncStatus {
  pendingCount: number;
  isSyncing: boolean;
}

export const useSyncStatus = (): SyncStatus => {
  const [pendingCount, setPendingCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    fetchCount();

    const intervalId = setInterval(fetchCount, APP_CONFIG.SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchCount]);

  return {
    pendingCount,
    isSyncing: pendingCount > 0,
  };
};
