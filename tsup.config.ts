import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: true,
  minify: false,
  splitting: false,
  bundle: true,
  platform: "node",
  external: [],
});
