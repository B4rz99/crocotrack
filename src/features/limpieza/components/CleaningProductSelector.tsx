import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { CleaningProductType } from "../api/cleaning-product-types.api";

interface ProductRow {
  readonly key: number;
  readonly cleaning_product_type_id: string;
  readonly quantity: number;
}

interface CleaningProductSelectorProps {
  readonly productTypes: readonly CleaningProductType[];
  readonly onChange: (
    products: ReadonlyArray<{ cleaning_product_type_id: string; quantity: number }>
  ) => void;
  readonly errors?: Record<string, string>;
}

export function CleaningProductSelector({
  productTypes,
  onChange,
  errors,
}: CleaningProductSelectorProps) {
  const keyCounter = useRef(1);
  const [rows, setRows] = useState<readonly ProductRow[]>([
    { key: 0, cleaning_product_type_id: "", quantity: 1 },
  ]);

  const selectedIds = new Set(rows.map((r) => r.cleaning_product_type_id).filter(Boolean));

  function emitChange(updated: readonly ProductRow[]) {
    onChange(
      updated
        .filter((r) => r.cleaning_product_type_id)
        .map((r) => ({
          cleaning_product_type_id: r.cleaning_product_type_id,
          quantity: r.quantity,
        }))
    );
  }

  function handleProductChange(key: number, productTypeId: string | null) {
    if (!productTypeId) return;
    const updated = rows.map((r) =>
      r.key === key ? { ...r, cleaning_product_type_id: productTypeId } : r
    );
    setRows(updated);
    emitChange(updated);
  }

  function handleQuantityChange(key: number, value: string) {
    const qty = Math.max(1, Number.parseInt(value, 10) || 1);
    const updated = rows.map((r) => (r.key === key ? { ...r, quantity: qty } : r));
    setRows(updated);
    emitChange(updated);
  }

  function handleAdd() {
    keyCounter.current += 1;
    const updated = [
      ...rows,
      { key: keyCounter.current, cleaning_product_type_id: "", quantity: 1 },
    ];
    setRows(updated);
  }

  function handleRemove(key: number) {
    const updated = rows.filter((r) => r.key !== key);
    setRows(updated);
    emitChange(updated);
  }

  const allProductsSelected = selectedIds.size >= productTypes.length;

  return (
    <div className="space-y-3">
      <Label>Productos utilizados</Label>
      {rows.map((row) => {
        const availableProducts = productTypes.filter(
          (pt) => pt.id === row.cleaning_product_type_id || !selectedIds.has(pt.id)
        );
        const selectedProduct = productTypes.find((pt) => pt.id === row.cleaning_product_type_id);

        return (
          <div key={row.key} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Select
                value={row.cleaning_product_type_id}
                onValueChange={(val) => handleProductChange(row.key, val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => selectedProduct?.name ?? "Seleccionar producto"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => handleQuantityChange(row.key, e.target.value)}
                aria-label="Cantidad"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(row.key)}
              disabled={rows.length <= 1}
              aria-label="Eliminar producto"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={allProductsSelected}
      >
        <PlusIcon className="mr-1 size-4" />
        Agregar producto
      </Button>

      {errors?.products && <p className="text-sm text-destructive">{errors.products}</p>}
    </div>
  );
}
