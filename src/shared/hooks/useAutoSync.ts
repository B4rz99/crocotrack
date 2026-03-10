import { useEffect, useRef } from "react";
import { APP_CONFIG } from "../constants/config";
import { flushOutbox } from "../lib/sync";
import { useOnlineStatus } from "./useOnlineStatus";

export function useAutoSync(): void {
  const { isOnline } = useOnlineStatus();
  const flushing = useRef(false);

  useEffect(() => {
    if (!isOnline) return;

    const safeFlush = () => {
      if (flushing.current) return;
      flushing.current = true;
      flushOutbox()
        .catch((err) => console.error("[sync] flush error:", err))
        .finally(() => {
          flushing.current = false;
        });
    };

    safeFlush();

    const intervalId = setInterval(safeFlush, APP_CONFIG.SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOnline]);
}
