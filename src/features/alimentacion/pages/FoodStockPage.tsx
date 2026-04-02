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
import { formatDateDisplay } from "@/shared/lib/utils";
import { FoodStockTable } from "../components/FoodStockTable";
import { useFoodPurchases } from "../hooks/useFoodPurchases";
import { useFoodStock } from "../hooks/useFoodStock";

export function FoodStockPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: stock = [], isLoading: stockLoading } = useFoodStock(farmId);
  const { data: purchases = [], isLoading: purchasesLoading } = useFoodPurchases(farmId);

  const listPath = ROUTES.ALIMENTACION.replace(":farmId", farmId);
  const purchaseCreatePath = ROUTES.FOOD_PURCHASE_CREATE.replace(":farmId", farmId);

  const isLoading = stockLoading || purchasesLoading;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a alimentaciones"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">Stock de Alimento</h1>
        <div className="ml-auto">
          <Link to={purchaseCreatePath}>
            <Button size="sm">
              <PlusIcon className="mr-1 size-4" />
              Registrar Compra
            </Button>
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Niveles de Stock</h2>
        <FoodStockTable stock={stock} purchaseCreatePath={purchaseCreatePath} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Compras Recientes</h2>
        {purchases.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateDisplay(p.purchase_date)}</TableCell>
                  <TableCell>{p.food_types?.name ?? "—"}</TableCell>
                  <TableCell>{p.quantity_kg} kg</TableCell>
                  <TableCell>{p.supplier ?? "—"}</TableCell>
                  <TableCell>{p.profiles?.full_name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No hay compras registradas.</p>
        )}
      </section>
    </div>
  );
}
