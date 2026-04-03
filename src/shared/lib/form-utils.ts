import type { z } from "zod";

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues
      .filter(
        (issue): issue is typeof issue & { path: [string, ...unknown[]] } =>
          typeof issue.path[0] === "string"
      )
      .map((issue) => [issue.path[0], issue.message])
  );
}

/** Extract per-row, per-field errors from array field paths like groups[i].field. */
export function zodArrayFieldErrors(
  error: z.ZodError,
  arrayKey: string
): Record<number, Record<string, string>> {
  return error.issues.reduce(
    (acc, issue) => {
      if (
        issue.path[0] === arrayKey &&
        typeof issue.path[1] === "number" &&
        typeof issue.path[2] === "string"
      ) {
        const idx = issue.path[1];
        const field = issue.path[2];
        acc[idx] = { ...(acc[idx] ?? {}), [field]: issue.message };
      }
      return acc;
    },
    {} as Record<number, Record<string, string>>
  );
}
