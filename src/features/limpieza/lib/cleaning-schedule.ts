import { addDaysIsoUtc, todayIsoDateUtc } from "@/shared/lib/iso-date";

export interface PoolCleaningStatus {
  readonly poolId: string;
  readonly poolName: string;
  readonly lastCleaningDate: string | null;
  readonly nextDueDate: string | null;
  readonly isOverdue: boolean;
}

interface PoolInfo {
  readonly id: string;
  readonly name: string;
}

interface LimpiezaInfo {
  readonly pool_id: string;
  readonly event_date: string;
}

export function getPoolCleaningStatuses(
  pools: readonly PoolInfo[],
  limpiezas: readonly LimpiezaInfo[],
  cleaningFrequencyDays: number | null
): readonly PoolCleaningStatus[] {
  return pools.map((pool) => {
    const poolLimpiezas = limpiezas.filter((l) => l.pool_id === pool.id);
    const lastCleaningDate =
      poolLimpiezas.length > 0
        ? poolLimpiezas.reduce(
            (latest, l) => (l.event_date > latest ? l.event_date : latest),
            poolLimpiezas[0]?.event_date ?? ""
          )
        : null;

    if (cleaningFrequencyDays === null || cleaningFrequencyDays === undefined) {
      return {
        poolId: pool.id,
        poolName: pool.name,
        lastCleaningDate,
        nextDueDate: null,
        isOverdue: false,
      };
    }

    if (lastCleaningDate === null) {
      return {
        poolId: pool.id,
        poolName: pool.name,
        lastCleaningDate: null,
        nextDueDate: null,
        isOverdue: true,
      };
    }

    const nextDueDate = addDaysIsoUtc(lastCleaningDate, cleaningFrequencyDays);
    const isOverdue = nextDueDate < todayIsoDateUtc();

    return {
      poolId: pool.id,
      poolName: pool.name,
      lastCleaningDate,
      nextDueDate,
      isOverdue,
    };
  });
}

export function countOverduePools(statuses: readonly PoolCleaningStatus[]): number {
  return statuses.filter((s) => s.isOverdue).length;
}
