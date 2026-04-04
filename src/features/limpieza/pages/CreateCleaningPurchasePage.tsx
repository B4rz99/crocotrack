import { ArrowLeftIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ROUTES } from "@/shared/constants/routes";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { todayIsoDate } from "@/shared/lib/utils";
import { createCleaningPurchaseSchema } from "@/shared/schemas/cleaning-purchase.schema";
import { useCleaningProductTypes } from "../hooks/useCleaningProductTypes";
import { useCreateCleaningPurchase } from "../hooks/useCreateCleaningPurchase";

export function CreateCleaningPurchasePage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: productTypes = [] } = useCleaningProductTypes();
  const createPurchase = useCreateCleaningPurchase(farmId);

  const stockPath = ROUTES.LIMPIEZA_STOCK.replace(":farmId", farmId);

  const [productTypeId, setProductTypeId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIsoDate);
  const [quantity, setQuantity] = useState(1);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedProduct = productTypes.find((pt) => pt.id === productTypeId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const raw = {
      cleaning_product_type_id: productTypeId,
      purchase_date: purchaseDate,
      quantity,
      supplier: supplier || undefined,
      notes: notes || undefined,
    };

    const result = createCleaningPurchaseSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    createPurchase.mutate(result.data, {
      onSuccess: () => {
        toast.success("Compra registrada exitosamente");
        navigate(stockPath);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Error al registrar la compra");
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver al stock"
          onClick={() => navigate(stockPath)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">Registrar Compra</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="product-select">Producto</Label>
          <Select value={productTypeId} onValueChange={(val) => val && setProductTypeId(val)}>
            <SelectTrigger
              id="product-select"
              className="w-full"
              aria-invalid={!!errors.cleaning_product_type_id}
            >
              <SelectValue>{() => selectedProduct?.name ?? "Seleccionar producto"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {productTypes.map((pt) => (
                <SelectItem key={pt.id} value={pt.id}>
                  {pt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.cleaning_product_type_id} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase-date">Fecha de compra</Label>
          <Input
            id="purchase-date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            aria-invalid={!!errors.purchase_date}
          />
          <FieldError message={errors.purchase_date} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Cantidad (unidades)</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 1)}
            aria-invalid={!!errors.quantity}
          />
          <FieldError message={errors.quantity} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier">Proveedor (opcional)</Label>
          <Input
            id="supplier"
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Observaciones adicionales..."
          />
        </div>

        <Button type="submit" disabled={createPurchase.isPending} className="w-full">
          {createPurchase.isPending ? "Registrando..." : "Registrar Compra"}
        </Button>
      </form>
    </div>
  );
}
