import { Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { CreateFoodTypeInput } from "@/shared/schemas/food-type.schema";

interface KeyedFoodType {
  readonly key: number;
  readonly data: CreateFoodTypeInput;
}

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
  const keyCounter = useRef(DEFAULT_FOOD_TYPES.length);

  const [foodTypes, setFoodTypes] = useState<readonly KeyedFoodType[]>(
    DEFAULT_FOOD_TYPES.map((ft, i) => ({ key: i, data: ft })),
  );
  const [newName, setNewName] = useState("");

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    keyCounter.current += 1;
    setFoodTypes((prev) => [
      ...prev,
      { key: keyCounter.current, data: { name: newName.trim(), unit: "kg" } },
    ]);
    setNewName("");
  }

  function handleRemove(key: number) {
    setFoodTypes((prev) => prev.filter((item) => item.key !== key));
  }

  function handleNext() {
    onNext(foodTypes.map((item) => item.data));
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {foodTypes.map((item) => (
          <li key={item.key} className="flex items-center justify-between rounded-lg border p-3">
            <span>{item.data.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(item.key)}
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
