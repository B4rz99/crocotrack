import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { Database } from "@/shared/types/database.types";

type Farm = Database["public"]["Tables"]["farms"]["Row"];

interface FarmSelectorProps {
  readonly farms: Farm[];
  readonly currentFarmId: string;
  readonly onFarmChange: (farmId: string) => void;
}

export function FarmSelector({ farms, currentFarmId, onFarmChange }: FarmSelectorProps) {
  const currentFarmName = farms.find((f) => f.id === currentFarmId)?.name ?? "Seleccionar granja";

  return (
    <Select
      value={currentFarmId}
      onValueChange={(value) => {
        if (value) onFarmChange(value);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={currentFarmName}>{() => currentFarmName}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {farms.map((farm) => (
          <SelectItem key={farm.id} value={farm.id}>
            {farm.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
