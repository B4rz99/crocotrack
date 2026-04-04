import { Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { CreateCleaningProductTypeInput } from "@/shared/schemas/cleaning-product-type.schema";

interface KeyedProduct {
  readonly key: number;
  readonly data: CreateCleaningProductTypeInput;
}

const DEFAULT_PRODUCTS: readonly CreateCleaningProductTypeInput[] = [
  { name: "Sulfato de Cobre" },
  { name: "Azul de Metileno" },
  { name: "Cal" },
];

interface CleaningProductSetupStepProps {
  readonly onNext: (data: readonly CreateCleaningProductTypeInput[]) => void;
  readonly onBack: () => void;
}

export function CleaningProductSetupStep({ onNext, onBack }: CleaningProductSetupStepProps) {
  const keyCounter = useRef(DEFAULT_PRODUCTS.length);

  const [products, setProducts] = useState<readonly KeyedProduct[]>(
    DEFAULT_PRODUCTS.map((p, i) => ({ key: i, data: p }))
  );
  const [newName, setNewName] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    keyCounter.current += 1;
    setProducts((prev) => [
      ...prev,
      { key: keyCounter.current, data: { name: newName.trim() } },
    ]);
    setNewName("");
  }

  function handleRemove(key: number) {
    setProducts((prev) => prev.filter((item) => item.key !== key));
  }

  function handleNext() {
    onNext(products.map((item) => item.data));
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {products.map((item) => (
          <li key={item.key} className="flex items-center justify-between rounded-lg border p-3">
            <span>{item.data.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(item.key)}
              aria-label="Eliminar"
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="product-name">Nombre del producto</Label>
          <Input
            id="product-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="self-end">
          Agregar
        </Button>
      </form>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="button" onClick={handleNext}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
