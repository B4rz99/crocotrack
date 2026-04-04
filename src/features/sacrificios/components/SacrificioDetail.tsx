import { formatDateDisplay } from "@/shared/lib/utils";
import type { SacrificioWithDetails } from "../api/sacrificios.api";

interface SacrificioDetailProps {
  readonly sacrificio: SacrificioWithDetails;
  readonly poolNames?: ReadonlyMap<string, string>;
}

export function SacrificioDetail({ sacrificio, poolNames = new Map() }: SacrificioDetailProps) {
  const sacrificados = sacrificio.sacrificio_size_groups.filter(
    (g) => g.group_type === "sacrificado"
  );
  const rechazados = sacrificio.sacrificio_size_groups.filter((g) => g.group_type === "rechazado");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Pileta</p>
          <p className="font-medium">{sacrificio.pools?.name ?? "Desconocida"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Fecha</p>
          <p className="font-medium">{formatDateDisplay(sacrificio.event_date)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Registrado por</p>
          <p className="font-medium">{sacrificio.profiles?.full_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total en lote</p>
          <p className="font-medium">{sacrificio.total_animals} animales</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{sacrificio.total_sacrificed}</p>
          <p className="text-sm text-muted-foreground">Sacrificados</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{sacrificio.total_rejected}</p>
          <p className="text-sm text-muted-foreground">Rechazados</p>
        </div>
        {sacrificio.total_faltantes > 0 && (
          <div className="rounded-lg border border-amber-500 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {sacrificio.total_faltantes}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">Faltantes</p>
          </div>
        )}
      </div>

      {sacrificados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Animales sacrificados</h3>
          <div className="flex flex-wrap gap-2">
            {sacrificados.map((g, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order for display
                key={`s-${g.size_inches}-${i}`}
                className="rounded-full bg-muted px-3 py-1 text-sm"
              >
                {g.size_inches}" — {g.animal_count}
              </span>
            ))}
          </div>
        </div>
      )}

      {rechazados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Animales rechazados</h3>
          <div className="space-y-2">
            {rechazados.map((g, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order for display
                key={`r-${g.size_inches}-${g.destination_pool_id}-${i}`}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span>
                  {g.size_inches}" — {g.animal_count} animales
                </span>
                <span className="text-muted-foreground">
                  →{" "}
                  {(g.destination_pool_id && poolNames.get(g.destination_pool_id)) ??
                    "Pileta desconocida"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sacrificio.notes && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Notas</h3>
          <p className="text-sm text-muted-foreground">{sacrificio.notes}</p>
        </div>
      )}
    </div>
  );
}
