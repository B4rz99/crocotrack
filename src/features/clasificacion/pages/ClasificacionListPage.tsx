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
import { useClasificaciones } from "../hooks/useClasificaciones";

export function ClasificacionListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: clasificaciones, isLoading, error } = useClasificaciones(farmId);

  const createPath = ROUTES.CLASIFICACION_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar las clasificaciones.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clasificación ({clasificaciones?.length ?? 0})</h1>
        <Link to={createPath}>
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Registrar Clasificación
          </Button>
        </Link>
      </div>

      {clasificaciones && clasificaciones.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pileta</TableHead>
              <TableHead>Total Animales</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clasificaciones.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{formatDateDisplay(c.event_date)}</TableCell>
                <TableCell>{c.pools?.name ?? "—"}</TableCell>
                <TableCell>{c.total_animals}</TableCell>
                <TableCell>{c.profiles?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay clasificaciones registradas.</p>
      )}
    </div>
  );
}
