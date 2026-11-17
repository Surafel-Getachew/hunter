import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Code that also runs under Node's type stripping must import types with
    // `import type`; a plain import of a type crashes at run time.
    files: ["src/lib/jobs/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "error" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
