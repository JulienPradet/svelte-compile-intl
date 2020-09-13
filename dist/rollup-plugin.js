'use strict';

require('path');
require('@babel/core');
require('intl-messageformat-parser');
require('fs');
require('chokidar');
require('debug');
var babelPlugin = require('./babel-plugin.js');
var babel = require('@rollup/plugin-babel');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var babel__default = /*#__PURE__*/_interopDefaultLegacy(babel);

const rollupCompileIntlPlugin = (locale, translationsFolder) => {
    return {
        ...babel__default['default']({
            babelHelpers: "bundled",
            plugins: [[babelPlugin, { locale, translationsFolder }]],
        }),
        name: "svelte-compile-intl",
    };
};

module.exports = rollupCompileIntlPlugin;
//# sourceMappingURL=rollup-plugin.js.map
