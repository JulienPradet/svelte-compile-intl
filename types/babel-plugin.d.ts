import { PluginTarget } from "@babel/core";
declare module "@babel/core" {
    interface BabelFileMetadata {
        usesIntl: boolean;
    }
}
declare const babelCompileIntlPlugin: PluginTarget;
export default babelCompileIntlPlugin;
