import { useEffect, useId, useRef, useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export interface PoolComboboxProps {
  readonly pools: readonly PoolWithLotes[];
  readonly value: string;
  readonly onChange: (poolId: string) => void;
  readonly error?: string;
  readonly id?: string;
  /** Shown in the input when selected, each list row, and included in text filter. Defaults to `pool.name`. */
  readonly getOptionLabel?: (pool: PoolWithLotes) => string;
  readonly placeholder?: string;
  /** When false, secondary code chip is not shown under the default label. */
  readonly showCodeHint?: boolean;
}

function defaultOptionLabel(pool: PoolWithLotes): string {
  return pool.name;
}

function matchesQuery(
  pool: PoolWithLotes,
  query: string,
  labelFn: (p: PoolWithLotes) => string
): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return (
    pool.name.toLowerCase().includes(q) ||
    (pool.code?.toLowerCase().includes(q) ?? false) ||
    labelFn(pool).toLowerCase().includes(q)
  );
}

export function PoolCombobox({
  pools,
  value,
  onChange,
  error,
  id,
  getOptionLabel,
  placeholder = "Escriba el nombre o código de la pileta…",
  showCodeHint = true,
}: PoolComboboxProps) {
  const labelFn = getOptionLabel ?? defaultOptionLabel;
  const labelFnRef = useRef(labelFn);
  labelFnRef.current = labelFn;

  const selectedPool = pools.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState(() => (selectedPool != null ? labelFn(selectedPool) : ""));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);
  const valueRef = useRef(value);
  const prevValueRef = useRef(value);
  queryRef.current = query;
  valueRef.current = value;
  const uid = useId();
  const listId = `${uid}-list`;

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (value) {
      const p = pools.find((x) => x.id === value);
      setQuery(p != null ? labelFnRef.current(p) : "");
      return;
    }

    // External clear (parent set value to "") while the input still shows the old label:
    // reset the field. If the user had already edited away from that label (divergence),
    // keep their text so they can finish searching.
    if (prev !== "") {
      const prevPool = pools.find((x) => x.id === prev);
      const prevLabel = prevPool != null ? labelFnRef.current(prevPool).trim() : "";
      if (prevLabel !== "" && queryRef.current.trim() === prevLabel) {
        setQuery("");
      }
    }
  }, [value, pools]);

  const matchingPools = pools.filter((p) => matchesQuery(p, query, labelFn));
  const filtered = open ? matchingPools : [];

  function selectPool(pool: PoolWithLotes) {
    setQuery(labelFn(pool));
    setOpen(false);
    setHighlightedIndex(-1);
    onChange(pool.id);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    setHighlightedIndex(-1);
    if (val.trim() === "") {
      onChange("");
      setQuery("");
      return;
    }
    if (value !== "") {
      const sel = pools.find((p) => p.id === value);
      if (sel != null && val.trim() !== labelFn(sel).trim()) {
        onChange("");
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
        const m = pools.filter((p) => matchesQuery(p, query, labelFn));
        setHighlightedIndex(m.length > 0 ? 0 : -1);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => {
        if (filtered.length === 0) return -1;
        return Math.min(i + 1, filtered.length - 1);
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const candidate = filtered[highlightedIndex];
      if (highlightedIndex >= 0 && candidate != null) {
        selectPool(candidate);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            const v = valueRef.current;
            const q = queryRef.current;
            if (v === "") return;
            const sel = pools.find((p) => p.id === v);
            if (sel != null && q.trim() !== labelFnRef.current(sel).trim()) {
              onChange("");
            }
          }, 150)
        }
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={!!error}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          highlightedIndex >= 0 ? `${uid}-option-${highlightedIndex}` : undefined
        }
        role="combobox"
        aria-autocomplete="list"
      />

      {open && filtered.length > 0 && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-input bg-popover py-1 shadow-lg"
        >
          {filtered.map((pool, i) => {
            const primary = labelFn(pool);
            const showChip =
              showCodeHint &&
              pool.code != null &&
              pool.code !== pool.name &&
              primary !== pool.code &&
              !primary.includes(pool.code);
            return (
              <div
                key={pool.id}
                id={`${uid}-option-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={pool.id === value}
                onMouseDown={() => selectPool(pool)}
                className={cn(
                  "cursor-default select-none px-3 py-2 text-sm",
                  i === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                  pool.id === value && i !== highlightedIndex && "font-medium"
                )}
              >
                {primary}
                {showChip && (
                  <span className="ml-2 text-xs text-muted-foreground">{pool.code}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-input bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
          No se encontraron piletas
        </div>
      )}
    </div>
  );
}
