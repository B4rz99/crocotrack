import { WifiIcon, WifiOffIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { useSyncStatus } from "@/shared/hooks/useSyncStatus";

interface AppShellProps {
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const { isOnline } = useOnlineStatus();
  const { pendingCount } = useSyncStatus();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
          <span className="text-lg font-bold text-primary md:hidden">CrocoTrack</span>

          <div className="ml-auto flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
              </span>
            )}
            <span
              className={`flex items-center gap-1 text-xs ${
                isOnline ? "text-primary" : "text-destructive"
              }`}
            >
              {isOnline ? <WifiIcon className="size-3.5" /> : <WifiOffIcon className="size-3.5" />}
              {isOnline ? "En línea" : "Sin conexión"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
