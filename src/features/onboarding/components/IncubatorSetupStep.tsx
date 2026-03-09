import { Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { CreateIncubatorInput } from "@/shared/schemas/incubator.schema";

interface KeyedIncubator {
  readonly key: string;
  readonly data: CreateIncubatorInput;
}

interface IncubatorSetupStepProps {
  readonly onNext: (data: readonly CreateIncubatorInput[]) => void;
  readonly onBack: () => void;
}

export function IncubatorSetupStep({ onNext, onBack }: IncubatorSetupStepProps) {
  const { t } = useTranslation("onboarding");
  const { t: tc } = useTranslation("common");
  const [enabled, setEnabled] = useState(false);
  const [incubators, setIncubators] = useState<readonly KeyedIncubator[]>([]);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const keyCounter = useRef(0);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const newIncubator: CreateIncubatorInput = {
      name: name.trim(),
      ...(capacity ? { capacity: Number(capacity) } : {}),
    };

    keyCounter.current += 1;
    setIncubators((prev) => [...prev, { key: `inc-${keyCounter.current}`, data: newIncubator }]);
    setName("");
    setCapacity("");
  }

  function handleRemove(key: string) {
    setIncubators((prev) => prev.filter((item) => item.key !== key));
  }

  function handleNext() {
    onNext(enabled ? incubators.map((item) => item.data) : []);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id="enable-incubators"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="enable-incubators">{t("incubator.enable")}</Label>
      </div>

      {enabled && (
        <>
          {incubators.length > 0 && (
            <ul className="space-y-2">
              {incubators.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <span>{item.data.name}</span>
                    {item.data.capacity && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({item.data.capacity})
                      </span>
                    )}
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
              <Label htmlFor="incubator-name">{t("incubator.name")}</Label>
              <Input
                id="incubator-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="incubator-capacity">{t("incubator.capacity")}</Label>
              <Input
                id="incubator-capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>

            <Button type="submit" variant="outline">
              {tc("actions.add")}
            </Button>
          </form>
        </>
      )}

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
