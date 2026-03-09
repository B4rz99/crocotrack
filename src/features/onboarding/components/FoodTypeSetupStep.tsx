import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { CreateFoodTypeInput } from "@/shared/schemas/food-type.schema";

const DEFAULT_FOOD_TYPES: readonly CreateFoodTypeInput[] = [
  { name: "Pollo", unit: "kg" },
  { name: "Pescado", unit: "kg" },
  { name: "Vísceras", unit: "kg" },
];

interface FoodTypeSetupStepProps {
  readonly onNext: (data: readonly CreateFoodTypeInput[]) => void;
  readonly onBack: () => void;
}

export function FoodTypeSetupStep({ onNext, onBack }: FoodTypeSetupStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");
  const [foodTypes, setFoodTypes] = useState<readonly CreateFoodTypeInput[]>([
    ...DEFAULT_FOOD_TYPES,
  ]);
  const [newName, setNewName] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setFoodTypes((prev) => [...prev, { name: newName.trim(), unit: "kg" }]);
    setNewName("");
  }

  function handleRemove(index: number) {
    setFoodTypes((prev) => prev.filter((_, i) => i !== index));
  }

  function handleNext() {
    onNext(foodTypes);
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {foodTypes.map((ft, index) => (
          <li key={ft.name} className="flex items-center justify-between rounded-lg border p-3">
            <span>{ft.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(index)}
              aria-label={tc("actions.remove")}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="food-name">{t("food_type.name")}</Label>
          <Input
            id="food-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="self-end">
          {tc("actions.add")}
        </Button>
      </form>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          {tc("actions.back")}
        </Button>
        <Button type="button" onClick={handleNext}>
          {tc("actions.next")}
        </Button>
      </div>
    </div>
  );
}
