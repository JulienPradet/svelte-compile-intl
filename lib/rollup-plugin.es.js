import 'path';
import '@babel/core';
import 'intl-messageformat-parser';
import 'fs';
import 'chokidar';
import 'debug';
import babelCompileIntlPlugin from './babel-plugin.es.js';
import babel from '@rollup/plugin-babel';

const rollupCompileIntlPlugin = (locale, translationsFolder) => {
    return {
        ...babel({
            babelHelpers: "bundled",
            plugins: [[babelCompileIntlPlugin, { locale, translationsFolder }]],
        }),
        name: "svelte-compile-intl",
    };
};

export default rollupCompileIntlPlugin;
//# sourceMappingURL=rollup-plugin.es.js.map
