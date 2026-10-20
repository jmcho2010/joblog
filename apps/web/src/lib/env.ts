import { z } from "zod";

// Empty values (e.g. copied straight from .env.example) count as unset.
const optionalText = z.string().min(1).optional();
const optionalUrl = z.url().optional();

const envSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
    SUPABASE_URL: optionalUrl,
    SUPABASE_SERVICE_ROLE_KEY: optionalText,
    CRON_KEY: optionalText,
    AI_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    SENTRY_DSN: optionalText,
    CLOCK_NOW_OVERRIDE: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
  })
  .refine(
    (value) => value.APP_ENV !== "production" || value.CLOCK_NOW_OVERRIDE === undefined,
    {
      // docs/design/RUNBOOK.md §5: a frozen clock must never reach production.
      message: "CLOCK_NOW_OVERRIDE must not be set when APP_ENV=production",
      path: ["CLOCK_NOW_OVERRIDE"],
    },
  );

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ""),
  );
  return envSchema.parse(present);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
