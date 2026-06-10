import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Two suites, run separately by the gate (see CONTRIBUTING):
// - unit: everything except the billing module
// - billing: the money-math fixture suite, kept separate because it is the
//   correctness core of the product and must stay independently runnable
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "{app,server,db,design,jobs,lib}/**/*.test.{ts,tsx}",
            "modules/{clients,projects,time,proposals}/**/*.test.{ts,tsx}",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "billing",
          include: [
            "modules/billing/**/*.test.{ts,tsx}",
            "fixtures/billing/**/*.test.ts",
          ],
        },
      },
    ],
  },
});
