import { PlusIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { FoodStockWithType } from "../api/food-stock.api";

interface FoodStockTableProps {
  readonly stock: readonly FoodStockWithType[];
  readonly purchaseCreatePath: string;
}

function stockColor(quantity: number, threshold: number | null): string {
  if (quantity <= 0) return "text-destructive font-medium";
  if (threshold !== null && quantity < threshold) return "text-amber-600 font-medium";
  return "";
}

export function FoodStockTable({ stock, purchaseCreatePath }: FoodStockTableProps) {
  if (stock.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay stock registrado. Registre una compra para comenzar.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo de Alimento</TableHead>
          <TableHead>Stock Actual</TableHead>
          <TableHead>Umbral</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {stock.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{s.food_types?.name ?? "—"}</TableCell>
            <TableCell className={stockColor(s.current_quantity, s.low_stock_threshold)}>
              {s.current_quantity} {s.food_types?.unit ?? "kg"}
            </TableCell>
            <TableCell>
              {s.low_stock_threshold !== null ? `${s.low_stock_threshold} kg` : "—"}
            </TableCell>
            <TableCell>
              <Link to={`${purchaseCreatePath}?food_type_id=${s.food_type_id}`}>
                <Button variant="ghost" size="icon-sm" aria-label="Registrar compra">
                  <PlusIcon className="size-4" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
