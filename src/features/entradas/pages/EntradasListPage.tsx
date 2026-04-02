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
import type { EntradaOriginType } from "@/shared/schemas/entrada.schema";
import { useEntradas } from "../hooks/useEntradas";

const ORIGIN_LABELS: Record<EntradaOriginType, string> = {
  proveedor_persona: "Proveedor Persona",
  proveedor_empresa: "Proveedor Empresa",
  finca_propia: "Finca Propia",
  incubador: "Incubador",
};

const ORIGIN_COLORS: Record<EntradaOriginType, string> = {
  proveedor_persona: "bg-blue-100 text-blue-700",
  proveedor_empresa: "bg-purple-100 text-purple-700",
  finca_propia: "bg-green-100 text-green-700",
  incubador: "bg-amber-100 text-amber-700",
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function EntradasListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: entradas, isLoading, error } = useEntradas(farmId);

  const createPath = ROUTES.ENTRADA_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar las entradas.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Entradas ({entradas?.length ?? 0})</h1>
        <Link to={createPath}>
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Nueva Entrada
          </Button>
        </Link>
      </div>

      {entradas && entradas.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo Origen</TableHead>
              <TableHead>Pileta</TableHead>
              <TableHead>Total Animales</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entradas.map((entrada) => (
              <TableRow key={entrada.id}>
                <TableCell>{formatDate(entrada.entry_date)}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      ORIGIN_COLORS[entrada.origin_type]
                    }`}
                  >
                    {ORIGIN_LABELS[entrada.origin_type]}
                  </span>
                </TableCell>
                <TableCell>{entrada.pools?.name ?? "—"}</TableCell>
                <TableCell>{entrada.total_animals}</TableCell>
                <TableCell>{entrada.profiles?.full_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay entradas registradas.</p>
      )}
    </div>
  );
}
