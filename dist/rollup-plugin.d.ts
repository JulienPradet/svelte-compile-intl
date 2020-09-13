import type { Plugin } from "rollup";
declare const rollupCompileIntlPlugin: (locale: string, translationsFolder: string) => Plugin;
export default rollupCompileIntlPlugin;
