import { PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
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
import { useAlimentaciones } from "../hooks/useAlimentaciones";

export function AlimentacionListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: alimentaciones, isLoading, error } = useAlimentaciones(farmId);

  const createPath = ROUTES.ALIMENTACION_CREATE.replace(":farmId", farmId);
  const stockPath = ROUTES.FOOD_STOCK.replace(":farmId", farmId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar las alimentaciones.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Alimentacion ({alimentaciones?.length ?? 0})</h1>
        <div className="flex gap-2">
          <Link to={stockPath}>
            <Button variant="outline" size="sm">
              Stock de Alimento
            </Button>
          </Link>
          <Link to={createPath}>
            <Button size="sm">
              <PlusIcon className="mr-1 size-4" />
              Registrar Alimentacion
            </Button>
          </Link>
        </div>
      </div>

      {alimentaciones && alimentaciones.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pileta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alimentaciones.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{formatDateDisplay(a.event_date)}</TableCell>
                <TableCell>{a.pools?.name ?? "—"}</TableCell>
                <TableCell>{a.food_types?.name ?? "—"}</TableCell>
                <TableCell>{a.quantity_kg} kg</TableCell>
                <TableCell>{a.profiles?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay alimentaciones registradas.</p>
      )}
    </div>
  );
}
