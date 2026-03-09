import type { z } from "zod";

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues
      .filter(
        (issue): issue is typeof issue & { path: [string, ...unknown[]] } =>
          typeof issue.path[0] === "string",
      )
      .map((issue) => [issue.path[0], issue.message]),
  );
}
