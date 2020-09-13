'use strict';

var path = require('path');
var core = require('@babel/core');
var intlMessageformatParser = require('intl-messageformat-parser');
var fs = require('fs');
var chokidar = require('chokidar');
var d = require('debug');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var chokidar__default = /*#__PURE__*/_interopDefaultLegacy(chokidar);
var d__default = /*#__PURE__*/_interopDefaultLegacy(d);

const debug = d__default['default']("svelte-compile-intl");
const HELPERS_MAP = {
    [intlMessageformatParser.TYPE.argument]: "__interpolate",
    [intlMessageformatParser.TYPE.number]: "__number",
    [intlMessageformatParser.TYPE.date]: "__date",
    [intlMessageformatParser.TYPE.time]: "__time",
    [intlMessageformatParser.TYPE.select]: "__select",
    [intlMessageformatParser.TYPE.plural]: "__plural",
    [intlMessageformatParser.TYPE.literal]: "none",
    [intlMessageformatParser.TYPE.pound]: "none",
    [intlMessageformatParser.TYPE.tag]: "none",
};
const PLURAL_ABBREVIATIONS = {
    zero: "z",
    one: "o",
    two: "t",
    few: "f",
    many: "m",
    other: "h",
};
const translationManagers = new Map();
const getTranslationsManager = (locale, translationsFolder) => {
    if (!translationManagers.has(locale)) {
        try {
            fs.accessSync(translationsFolder);
        }
        catch {
            fs.mkdirSync(translationsFolder);
        }
        const translationsFile = path.join(translationsFolder, `${locale}.json`);
        let rawMessages = "{}";
        try {
            rawMessages = fs.readFileSync(translationsFile).toString();
        }
        catch (e) {
            fs.writeFileSync(translationsFile, "{}");
            debug(`Creating new translations for locale ${locale} in ${JSON.stringify(translationsFile)}`);
        }
        let messages = JSON.parse(rawMessages);
        const readTranslations = () => {
            return new Promise((resolve, reject) => {
                fs.readFile(translationsFile, (err, buffer) => {
                    if (err) {
                        console.error(`Failed to read translation for locale ${locale}. Does the file ${translationsFile} exist?`);
                        reject(err);
                        return;
                    }
                    messages = JSON.parse(buffer.toString());
                    resolve();
                });
            });
        };
        let throttle;
        const updateTranslations = (messages) => {
            if (throttle) {
                clearTimeout(throttle);
            }
            throttle = setTimeout(() => {
                throttle = null;
                new Promise((resolve) => {
                    debug(`Updating translation file for ${locale}.`);
                    fs.writeFile(translationsFile, JSON.stringify(messages, null, 2), (error) => {
                        if (error) {
                            console.error(`Failed to add missing translation for ${locale}.`);
                            console.error(error);
                            return;
                        }
                        resolve();
                    });
                });
            }, 200);
        };
        const watcher = chokidar__default['default'].watch(translationsFile).on("change", () => {
            debug(`Translation change detected`);
            readTranslations();
        });
        translationManagers.set(locale, {
            close: () => {
                watcher.close();
            },
            get: (messageId) => {
                if (!messages[messageId]) {
                    messages[messageId] = messageId;
                    debug(`New translation found for locale ${locale}: ${JSON.stringify(messageId)}`);
                    updateTranslations(messages);
                }
                return messages[messageId];
            },
        });
    }
    return translationManagers.get(locale);
};
const resetTranslationManagers = () => {
    for (const [key, translations] of translationManagers.entries()) {
        translations.close();
        translationManagers.delete(key);
    }
};
const babelCompileIntlPlugin = (api, options) => {
    const translations = getTranslationsManager(options.locale, options.translationsFolder);
    let usedHelpers = new Set();
    let currentFunctionParams = new Set();
    let pluralsStack = [];
    function normalizePluralKey(key) {
        if (PLURAL_ABBREVIATIONS[key]) {
            return PLURAL_ABBREVIATIONS[key];
        }
        key = key.trim();
        const match = key.match(/^=(\d)/);
        if (match)
            return parseInt(match[1], 10);
        return key;
    }
    function normalizeKey(key) {
        key = key.trim();
        const match = key.match(/^=(\d)/);
        if (match)
            return parseInt(match[1], 10);
        return key;
    }
    function buildCallExpression(entry, parent) {
        const fnName = HELPERS_MAP[entry.type];
        if (entry.type === intlMessageformatParser.TYPE.literal || entry.type === intlMessageformatParser.TYPE.tag) {
            throw new Error("Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace.");
        }
        if (entry.type === intlMessageformatParser.TYPE.pound) {
            if (parent?.type === intlMessageformatParser.TYPE.plural) {
                return core.types.identifier(parent.value);
            }
            throw new Error("Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace.");
        }
        if (entry.type === intlMessageformatParser.TYPE.plural && entry.offset !== 0) {
            usedHelpers.add("__offsetPlural");
        }
        else if (fnName !== "none") {
            usedHelpers.add(fnName);
        }
        if (entry.type === intlMessageformatParser.TYPE.argument ||
            entry.type === intlMessageformatParser.TYPE.number ||
            entry.type === intlMessageformatParser.TYPE.date ||
            entry.type === intlMessageformatParser.TYPE.time) {
            let callArgs;
            if (entry.type === intlMessageformatParser.TYPE.number ||
                entry.type === intlMessageformatParser.TYPE.date ||
                entry.type === intlMessageformatParser.TYPE.time) {
                const element = entry;
                currentFunctionParams.add(element.value);
                callArgs = [core.types.identifier(element.value)];
                if (typeof element.style === "string") {
                    callArgs.push(core.types.stringLiteral(element.style));
                }
                else if (element.style) {
                    throw new Error("Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace.");
                }
            }
            else {
                const element = entry;
                callArgs = [core.types.identifier(element.value)];
            }
            return core.types.callExpression(core.types.identifier(fnName), callArgs);
        }
        if (entry.type === intlMessageformatParser.TYPE.plural) {
            pluralsStack.push(entry);
        }
        const options = core.types.objectExpression(Object.keys(entry.options).map((key) => {
            const objValueAST = entry.options[key].value;
            let objValue;
            if (objValueAST.length === 1 && objValueAST[0].type === intlMessageformatParser.TYPE.literal) {
                objValue = core.types.stringLiteral(objValueAST[0].value);
            }
            else {
                objValue =
                    objValueAST.length === 1
                        ? buildCallExpression(objValueAST[0], entry)
                        : buildTemplateLiteral(objValueAST);
            }
            const normalizedKey = entry.type === intlMessageformatParser.TYPE.plural
                ? normalizePluralKey(key)
                : normalizeKey(key);
            return core.types.objectProperty(typeof normalizedKey === "number"
                ? core.types.numericLiteral(normalizedKey)
                : core.types.identifier(normalizedKey), objValue);
        }));
        if (entry.type === intlMessageformatParser.TYPE.plural) {
            pluralsStack.pop();
        }
        currentFunctionParams.add(entry.value);
        let fnIdentifier = core.types.identifier(fnName);
        const callArguments = [core.types.identifier(entry.value)];
        if (entry.type === intlMessageformatParser.TYPE.plural && entry.offset !== 0) {
            fnIdentifier = core.types.identifier("__offsetPlural");
            callArguments.push(core.types.numericLiteral(entry.offset));
        }
        callArguments.push(options);
        return core.types.callExpression(fnIdentifier, callArguments);
    }
    function buildTemplateLiteral(ast) {
        const quasis = [];
        const expressions = [];
        for (let i = 0; i < ast.length; i++) {
            const entry = ast[i];
            switch (entry.type) {
                case 0: {
                    // literal
                    const literal = entry;
                    quasis.push(core.types.templateElement({ cooked: literal.value, raw: literal.value }, i === ast.length - 1 // tail
                    ));
                    break;
                }
                case 1: {
                    // intepolation
                    const interpolation = entry;
                    expressions.push(buildCallExpression(interpolation));
                    currentFunctionParams.add(interpolation.value);
                    if (i === 0)
                        quasis.push(core.types.templateElement({ cooked: "", raw: "" }, false));
                    break;
                }
                case 2: {
                    // Number format
                    const number = entry;
                    expressions.push(buildCallExpression(number));
                    currentFunctionParams.add(number.value);
                    break;
                }
                case 3: {
                    // Date format
                    const date = entry;
                    expressions.push(buildCallExpression(date));
                    currentFunctionParams.add(date.value);
                    break;
                }
                case 4: {
                    // Time format
                    const time = entry;
                    expressions.push(buildCallExpression(time));
                    currentFunctionParams.add(time.value);
                    break;
                }
                case 5: // select
                    expressions.push(buildCallExpression(entry));
                    break;
                case 6: // plural
                    expressions.push(buildCallExpression(entry));
                    break;
                case 7: {
                    // # interpolation
                    const lastPlural = pluralsStack[pluralsStack.length - 1];
                    if (lastPlural.offset !== null && lastPlural.offset !== 0) {
                        expressions.push(core.types.binaryExpression("-", core.types.identifier(lastPlural.value), core.types.numericLiteral(lastPlural.offset)));
                    }
                    else {
                        expressions.push(core.types.identifier(lastPlural.value));
                    }
                    if (i === 0)
                        quasis.push(core.types.templateElement({ cooked: "", raw: "" }, false));
                    break;
                }
                default:
                    console.error("Unsupported entry type. Please open an issue in svelte-compile-intl.");
            }
            if (i === ast.length - 1 && entry.type !== 0) {
                quasis.push(core.types.templateElement({ cooked: "", raw: "" }, true));
            }
        }
        return core.types.templateLiteral(quasis, expressions);
    }
    function buildFunction(ast) {
        currentFunctionParams = new Set();
        pluralsStack = [];
        const body = ast.length === 1
            ? buildCallExpression(ast[0])
            : buildTemplateLiteral(ast);
        return core.types.arrowFunctionExpression(Array.from(currentFunctionParams)
            .sort()
            .map((p) => core.types.identifier(p)), body);
    }
    return {
        visitor: {
            Program: {
                enter: () => {
                    usedHelpers = new Set();
                },
                exit(path) {
                    this.file.metadata.usesIntl =
                        usedHelpers.size > 0;
                    if (usedHelpers.size > 0) {
                        const importDeclaration = core.types.importDeclaration(Array.from(usedHelpers)
                            .sort()
                            .map((name) => core.types.importSpecifier(core.types.identifier(name), core.types.identifier(name))), core.types.stringLiteral("svelte-compile-intl"));
                        path.unshiftContainer("body", importDeclaration);
                    }
                },
            },
            CallExpression({ node }) {
                if (core.types.isIdentifier(node.callee) && node.callee.name === "_") {
                    if (node.arguments?.length >= 1 &&
                        core.types.isStringLiteral(node.arguments[0])) {
                        const messageId = node.arguments[0].value;
                        const translatedMessage = translations.get(messageId);
                        const icuAST = intlMessageformatParser.parse(translatedMessage);
                        if (icuAST.length === 1 && icuAST[0].type === 0) {
                            node.arguments[0] = core.types.stringLiteral(translatedMessage);
                        }
                        else {
                            node.arguments[0] = buildFunction(icuAST);
                        }
                    }
                }
            },
        },
        post: () => {
            resetTranslationManagers();
        },
    };
};

module.exports = babelCompileIntlPlugin;
//# sourceMappingURL=babel-plugin.js.map
