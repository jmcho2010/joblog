import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const noDateNow = {
  object: "Date",
  property: "now",
  message: "Read the time through Clock (src/lib/clock.ts).",
};
const noBareNewDate = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: "Read the time through Clock (src/lib/clock.ts).",
};
const noProcessEnv = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: "Read environment values through src/lib/env.ts.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": ["error", noDateNow],
      "no-restricted-syntax": ["error", noBareNewDate, noProcessEnv],
    },
  },
  {
    files: ["src/lib/clock.ts"],
    rules: {
      "no-restricted-properties": "off",
      "no-restricted-syntax": ["error", noProcessEnv],
    },
  },
  {
    files: ["src/lib/env.ts"],
    rules: {
      "no-restricted-syntax": ["error", noBareNewDate],
    },
  },
]);
