import typescript from "@rollup/plugin-typescript";

import pkg from "./package.json";

const external = Object.keys(pkg.dependencies)
  .concat(pkg.devDependencies)
  .concat(["path", "fs", "typescript"]);

export default {
  input: ["src/index.ts", "src/rollup-plugin.ts", "src/babel-plugin.ts"],
  plugins: [typescript()],
  external,
  output: [
    {
      sourcemap: true,
      format: "cjs",
      dir: ".",
      entryFileNames: "dist/[name].js",
      exports: "auto",
    },
    {
      sourcemap: true,
      format: "esm",
      dir: ".",
      entryFileNames: "dist/[name].[format].js",
    },
  ],
};
