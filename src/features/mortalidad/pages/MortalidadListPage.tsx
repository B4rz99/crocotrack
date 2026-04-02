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
import { useMortalidades } from "../hooks/useMortalidades";

export function MortalidadListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: mortalidades, isLoading, error } = useMortalidades(farmId);

  const createPath = ROUTES.MORTALIDAD_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar las mortalidades.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mortalidad ({mortalidades?.length ?? 0})</h1>
        <Link to={createPath}>
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Registrar Mortalidad
          </Button>
        </Link>
      </div>

      {mortalidades && mortalidades.length > 0 ? (
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
            {mortalidades.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{formatDateDisplay(m.event_date)}</TableCell>
                <TableCell>{m.pools?.name ?? "—"}</TableCell>
                <TableCell>{m.total_animals}</TableCell>
                <TableCell>{m.profiles?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay mortalidades registradas.</p>
      )}
    </div>
  );
}
