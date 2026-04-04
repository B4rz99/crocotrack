import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
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
import { useCleaningStock } from "../hooks/useCleaningStock";

export function CleaningStockPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: stock, isLoading, error } = useCleaningStock(farmId);

  const listPath = ROUTES.LIMPIEZA.replace(":farmId", farmId);
  const createPath = ROUTES.LIMPIEZA_STOCK_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar el stock.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Volver a limpiezas"
            onClick={() => navigate(listPath)}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <h1 className="text-xl font-bold">Stock de Productos</h1>
        </div>
        <Link to={createPath}>
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Registrar Compra
          </Button>
        </Link>
      </div>

      {stock && stock.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad Actual</TableHead>
              <TableHead>Umbral</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.map((s) => {
              const isLow =
                s.low_stock_threshold !== null && s.current_quantity <= s.low_stock_threshold;
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.cleaning_product_types?.name ?? "—"}</TableCell>
                  <TableCell>{s.current_quantity}</TableCell>
                  <TableCell>{s.low_stock_threshold ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        isLow
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                          : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                      }`}
                    >
                      {isLow ? "Bajo" : "OK"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No hay stock registrado.</p>
      )}
    </div>
  );
}
