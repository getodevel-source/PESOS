import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude the Electron build output. Linting the bundled app under
    // dist/ produces duplicate errors against already-compiled code and
    // slows the lint pass considerably. Mirrors the scope used by vitest.
    "dist/**",
  ]),
  // The Electron entrypoints (electron.js, updater.js, updater-bridge.js,
  // scripts/bot-daemon.js) are CommonJS Node scripts, not TypeScript
  // modules. Disable TS-only rules for plain .js files so the CommonJS
  // `require()` calls they need don't trip @typescript-eslint.
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
]);

export default eslintConfig;
