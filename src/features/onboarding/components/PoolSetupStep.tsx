import { type FormEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import type { CreatePoolInput } from "@/shared/schemas/pool.schema";

interface PoolGroupConfig {
  readonly id: number;
  readonly poolType: "crianza" | "reproductor";
  readonly quantity: string;
  readonly prefix: string;
  readonly startNumber: string;
  readonly capacity: string;
}

interface PoolSetupStepProps {
  readonly onNext: (data: readonly CreatePoolInput[]) => void;
  readonly onBack: () => void;
}

const MAX_PREVIEW = 6;

function generatePoolNames(
  prefix: string,
  startNumber: number,
  quantity: number,
): readonly string[] {
  return Array.from({ length: quantity }, (_, i) => `${prefix}${startNumber + i}`);
}

function buildPoolsFromGroup(group: PoolGroupConfig): readonly CreatePoolInput[] {
  const qty = Number(group.quantity) || 0;
  const start = Number(group.startNumber) || 1;
  const cap = Number(group.capacity) || 0;

  if (qty <= 0 || cap <= 0) return [];

  const names = generatePoolNames(group.prefix, start, qty);
  return names.map((name) => ({
    name,
    pool_type: group.poolType,
    capacity: cap,
  }));
}

function makeEmptyGroup(id: number, poolType: "crianza" | "reproductor"): PoolGroupConfig {
  return {
    id,
    poolType,
    quantity: "",
    prefix: poolType === "reproductor" ? "R" : "",
    startNumber: "1",
    capacity: "",
  };
}

export function PoolSetupStep({ onNext, onBack }: PoolSetupStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");

  const idCounter = useRef(1);
  const [groups, setGroups] = useState<readonly PoolGroupConfig[]>([makeEmptyGroup(0, "crianza")]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function addGroup() {
    const id = idCounter.current++;
    setGroups((prev) => [...prev, makeEmptyGroup(id, "crianza")]);
  }

  function removeGroup(id: number) {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function updateGroup(id: number, updates: Partial<PoolGroupConfig>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }

  const { previews, totalCount } = useMemo(() => {
    const pv = groups.map((group) => {
      const qty = Number(group.quantity) || 0;
      const start = Number(group.startNumber) || 1;
      if (qty <= 0) return [];
      const previewCount = Math.min(qty, MAX_PREVIEW);
      return generatePoolNames(group.prefix, start, previewCount);
    });
    const total = groups.reduce((sum, g) => {
      const qty = Number(g.quantity) || 0;
      const cap = Number(g.capacity) || 0;
      return sum + (qty > 0 && cap > 0 ? qty : 0);
    }, 0);
    return { previews: pv, totalCount: total };
  }, [groups]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};

    for (const g of groups) {
      const qty = Number(g.quantity);
      const cap = Number(g.capacity);

      if (!Number.isInteger(qty) || qty <= 0) {
        newErrors[`${g.id}-quantity`] = t("pool.error_quantity");
      }
      if (!Number.isInteger(cap) || cap <= 0) {
        newErrors[`${g.id}-capacity`] = t("pool.error_capacity");
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext(groups.flatMap(buildPoolsFromGroup));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("pool.batch_description")}</p>

      {groups.map((group, index) => {
        const preview = previews[index] ?? [];
        const qty = Number(group.quantity) || 0;

        return (
          <div key={group.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{t("pool.group_label", { n: index + 1 })}</h4>
              {groups.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGroup(group.id)}
                >
                  {tc("actions.remove")}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`pool-type-${group.id}`}>{t("pool.type")}</Label>
                <Select
                  value={group.poolType}
                  onValueChange={(v) => {
                    if (!v) return;
                    const poolType = v as "crianza" | "reproductor";
                    const newPrefix =
                      poolType === "reproductor" && !group.prefix ? "R" : group.prefix;
                    updateGroup(group.id, { poolType, prefix: newPrefix });
                  }}
                >
                  <SelectTrigger id={`pool-type-${group.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crianza">{t("pool.type_crianza")}</SelectItem>
                    <SelectItem value="reproductor">{t("pool.type_reproductor")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`pool-qty-${group.id}`}>{t("pool.quantity")}</Label>
                <Input
                  id={`pool-qty-${group.id}`}
                  type="number"
                  min="1"
                  value={group.quantity}
                  onChange={(e) => updateGroup(group.id, { quantity: e.target.value })}
                  placeholder="150"
                  aria-invalid={!!errors[`${group.id}-quantity`]}
                />
                <FieldError message={errors[`${group.id}-quantity`]} />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`pool-prefix-${group.id}`}>{t("pool.prefix")}</Label>
                <Input
                  id={`pool-prefix-${group.id}`}
                  type="text"
                  value={group.prefix}
                  onChange={(e) => updateGroup(group.id, { prefix: e.target.value })}
                  placeholder={t("pool.prefix_placeholder")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`pool-start-${group.id}`}>{t("pool.start_number")}</Label>
                <Input
                  id={`pool-start-${group.id}`}
                  type="number"
                  min="1"
                  value={group.startNumber}
                  onChange={(e) => updateGroup(group.id, { startNumber: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor={`pool-cap-${group.id}`}>{t("pool.capacity_per_pool")}</Label>
                <Input
                  id={`pool-cap-${group.id}`}
                  type="number"
                  min="1"
                  value={group.capacity}
                  onChange={(e) => updateGroup(group.id, { capacity: e.target.value })}
                  placeholder="200"
                  aria-invalid={!!errors[`${group.id}-capacity`]}
                />
                <FieldError message={errors[`${group.id}-capacity`]} />
              </div>
            </div>

            {preview.length > 0 && (
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("pool.preview")}
                </p>
                <p className="text-sm">
                  {preview.join(", ")}
                  {qty > MAX_PREVIEW && (
                    <span className="text-muted-foreground">
                      {" "}
                      ... {t("pool.and_more", { count: qty - MAX_PREVIEW })}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        );
      })}

      <Button type="button" variant="outline" className="w-full" onClick={addGroup}>
        {t("pool.add_group")}
      </Button>

      {totalCount > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {t("pool.total_summary", { count: totalCount })}
        </p>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          {tc("actions.back")}
        </Button>
        <Button type="submit">{tc("actions.next")}</Button>
      </div>
    </form>
  );
}
