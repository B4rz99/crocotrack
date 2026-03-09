import { Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type CreatePoolInput, createPoolSchema } from "@/shared/schemas/pool.schema";

interface KeyedPool {
  readonly key: string;
  readonly data: CreatePoolInput;
}

interface PoolSetupStepProps {
  readonly onNext: (data: readonly CreatePoolInput[]) => void;
  readonly onBack: () => void;
}

export function PoolSetupStep({ onNext, onBack }: PoolSetupStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");
  const [pools, setPools] = useState<readonly KeyedPool[]>([]);
  const [name, setName] = useState("");
  const [poolType, setPoolType] = useState<"crianza" | "reproductor">("crianza");
  const [capacity, setCapacity] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const keyCounter = useRef(0);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = createPoolSchema.safeParse({
      name,
      pool_type: poolType,
      capacity: capacity ? Number(capacity) : undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    keyCounter.current += 1;
    setPools((prev) => [...prev, { key: `pool-${keyCounter.current}`, data: result.data }]);
    setName("");
    setCapacity("");
  }

  function handleRemove(key: string) {
    setPools((prev) => prev.filter((item) => item.key !== key));
  }

  function handleNext() {
    onNext(pools.map((item) => item.data));
  }

  return (
    <div className="space-y-4">
      {pools.length > 0 && (
        <ul className="space-y-2">
          {pools.map((item) => (
            <li key={item.key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <span>{item.data.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({t(`pool.type_${item.data.pool_type}`)}) - {item.data.capacity}
                </span>
              </div>
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
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="pool-name">{t("pool.name")}</Label>
          <Input
            id="pool-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p role="alert" className="text-sm text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="pool-type">{t("pool.type")}</Label>
          <select
            id="pool-type"
            value={poolType}
            onChange={(e) => setPoolType(e.target.value as "crianza" | "reproductor")}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
          >
            <option value="crianza">{t("pool.type_crianza")}</option>
            <option value="reproductor">{t("pool.type_reproductor")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pool-capacity">{t("pool.capacity")}</Label>
          <Input
            id="pool-capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            aria-invalid={!!errors.capacity}
          />
          {errors.capacity && (
            <p role="alert" className="text-sm text-destructive">
              {errors.capacity}
            </p>
          )}
        </div>

        <Button type="submit" variant="outline">
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
