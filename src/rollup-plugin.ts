import type { Plugin } from "rollup";
import babelCompileIntlPlugin from "./babel-plugin";
import babel from "@rollup/plugin-babel";

const rollupCompileIntlPlugin = (
  locale: string,
  translationsFolder: string
): Plugin => {
  return {
    ...babel({
      babelHelpers: "bundled",
      plugins: [[babelCompileIntlPlugin, { locale, translationsFolder }]],
    }),
    name: "svelte-compile-intl",
  };
};

export default rollupCompileIntlPlugin;
