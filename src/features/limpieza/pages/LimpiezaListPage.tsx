import { AlertTriangleIcon, PackageIcon, PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { useFarms } from "@/features/farms/hooks/useFarms";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ROUTES } from "@/shared/constants/routes";
import { formatDateDisplay } from "@/shared/lib/utils";
import { useLimpiezas } from "../hooks/useLimpiezas";
import { countOverduePools, getPoolCleaningStatuses } from "../lib/cleaning-schedule";

export function LimpiezaListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: limpiezas, isLoading, error } = useLimpiezas(farmId);
  const { data: pools } = usePools(farmId);
  const { data: farms } = useFarms();

  const createPath = ROUTES.LIMPIEZA_CREATE.replace(":farmId", farmId);
  const stockPath = ROUTES.LIMPIEZA_STOCK.replace(":farmId", farmId);

  const currentFarm = farms?.find((f) => f.id === farmId);
  // cleaning_frequency_days is not yet in generated Supabase types; cast until types are regenerated
  const cleaningFrequencyDays =
    (currentFarm as { cleaning_frequency_days?: number } | undefined)?.cleaning_frequency_days ??
    null;

  const allPools = pools?.map((p) => ({ id: p.id, name: p.name })) ?? [];
  const limpiezaInfos =
    limpiezas?.map((l) => ({ pool_id: l.pool_id, event_date: l.event_date })) ?? [];
  const statuses = getPoolCleaningStatuses(allPools, limpiezaInfos, cleaningFrequencyDays ?? null);
  const overdueCount = countOverduePools(statuses);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar las limpiezas.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Limpieza ({limpiezas?.length ?? 0})</h1>
        <div className="flex gap-2">
          <Link to={stockPath}>
            <Button size="sm" variant="outline">
              <PackageIcon className="mr-1 size-4" />
              Stock
            </Button>
          </Link>
          <Link to={createPath}>
            <Button size="sm">
              <PlusIcon className="mr-1 size-4" />
              Registrar Limpieza
            </Button>
          </Link>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {overdueCount}{" "}
          {overdueCount === 1 ? "pileta con limpieza vencida" : "piletas con limpieza vencida"}
        </div>
      )}

      {limpiezas && limpiezas.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pileta</TableHead>
              <TableHead>Productos</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limpiezas.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{formatDateDisplay(l.event_date)}</TableCell>
                <TableCell>{l.pools?.name ?? "—"}</TableCell>
                <TableCell>
                  {l.limpieza_products
                    .map((p) => p.cleaning_product_types?.name ?? "—")
                    .join(", ") || "—"}
                </TableCell>
                <TableCell>{l.profiles?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay limpiezas registradas.</p>
      )}
    </div>
  );
}
