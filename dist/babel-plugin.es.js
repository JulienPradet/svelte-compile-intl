import { join } from 'path';
import { types } from '@babel/core';
import { TYPE, parse } from 'intl-messageformat-parser';
import { accessSync, mkdirSync, readFileSync, writeFileSync, readFile, writeFile } from 'fs';
import chokidar from 'chokidar';
import d from 'debug';

const debug = d("svelte-compile-intl");
const HELPERS_MAP = {
    [TYPE.argument]: "__interpolate",
    [TYPE.number]: "__number",
    [TYPE.date]: "__date",
    [TYPE.time]: "__time",
    [TYPE.select]: "__select",
    [TYPE.plural]: "__plural",
    [TYPE.literal]: "none",
    [TYPE.pound]: "none",
    [TYPE.tag]: "none",
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
            accessSync(translationsFolder);
        }
        catch {
            mkdirSync(translationsFolder);
        }
        const translationsFile = join(translationsFolder, `${locale}.json`);
        let rawMessages = "{}";
        try {
            rawMessages = readFileSync(translationsFile).toString();
        }
        catch (e) {
            writeFileSync(translationsFile, "{}");
            debug(`Creating new translations for locale ${locale} in ${JSON.stringify(translationsFile)}`);
        }
        let messages = JSON.parse(rawMessages);
        const readTranslations = () => {
            return new Promise((resolve, reject) => {
                readFile(translationsFile, (err, buffer) => {
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
                    writeFile(translationsFile, JSON.stringify(messages, null, 2), (error) => {
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
        const watcher = chokidar.watch(translationsFile).on("change", () => {
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
        if (entry.type === TYPE.literal || entry.type === TYPE.tag) {
            throw new Error("Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace.");
        }
        if (entry.type === TYPE.pound) {
            if (parent?.type === TYPE.plural) {
                return types.identifier(parent.value);
            }
            throw new Error("Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace.");
        }
        if (entry.type === TYPE.plural && entry.offset !== 0) {
            usedHelpers.add("__offsetPlural");
        }
        else if (fnName !== "none") {
            usedHelpers.add(fnName);
        }
        if (entry.type === TYPE.argument ||
            entry.type === TYPE.number ||
            entry.type === TYPE.date ||
            entry.type === TYPE.time) {
            let callArgs;
            if (entry.type === TYPE.number ||
                entry.type === TYPE.date ||
                entry.type === TYPE.time) {
                const element = entry;
                currentFunctionParams.add(element.value);
                callArgs = [types.identifier(element.value)];
                if (typeof element.style === "string") {
                    callArgs.push(types.stringLiteral(element.style));
                }
                else if (element.style) {
                    throw new Error("Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace.");
                }
            }
            else {
                const element = entry;
                callArgs = [types.identifier(element.value)];
            }
            return types.callExpression(types.identifier(fnName), callArgs);
        }
        if (entry.type === TYPE.plural) {
            pluralsStack.push(entry);
        }
        const options = types.objectExpression(Object.keys(entry.options).map((key) => {
            const objValueAST = entry.options[key].value;
            let objValue;
            if (objValueAST.length === 1 && objValueAST[0].type === TYPE.literal) {
                objValue = types.stringLiteral(objValueAST[0].value);
            }
            else {
                objValue =
                    objValueAST.length === 1
                        ? buildCallExpression(objValueAST[0], entry)
                        : buildTemplateLiteral(objValueAST);
            }
            const normalizedKey = entry.type === TYPE.plural
                ? normalizePluralKey(key)
                : normalizeKey(key);
            return types.objectProperty(typeof normalizedKey === "number"
                ? types.numericLiteral(normalizedKey)
                : types.identifier(normalizedKey), objValue);
        }));
        if (entry.type === TYPE.plural) {
            pluralsStack.pop();
        }
        currentFunctionParams.add(entry.value);
        let fnIdentifier = types.identifier(fnName);
        const callArguments = [types.identifier(entry.value)];
        if (entry.type === TYPE.plural && entry.offset !== 0) {
            fnIdentifier = types.identifier("__offsetPlural");
            callArguments.push(types.numericLiteral(entry.offset));
        }
        callArguments.push(options);
        return types.callExpression(fnIdentifier, callArguments);
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
                    quasis.push(types.templateElement({ cooked: literal.value, raw: literal.value }, i === ast.length - 1 // tail
                    ));
                    break;
                }
                case 1: {
                    // intepolation
                    const interpolation = entry;
                    expressions.push(buildCallExpression(interpolation));
                    currentFunctionParams.add(interpolation.value);
                    if (i === 0)
                        quasis.push(types.templateElement({ cooked: "", raw: "" }, false));
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
                        expressions.push(types.binaryExpression("-", types.identifier(lastPlural.value), types.numericLiteral(lastPlural.offset)));
                    }
                    else {
                        expressions.push(types.identifier(lastPlural.value));
                    }
                    if (i === 0)
                        quasis.push(types.templateElement({ cooked: "", raw: "" }, false));
                    break;
                }
                default:
                    console.error("Unsupported entry type. Please open an issue in svelte-compile-intl.");
            }
            if (i === ast.length - 1 && entry.type !== 0) {
                quasis.push(types.templateElement({ cooked: "", raw: "" }, true));
            }
        }
        return types.templateLiteral(quasis, expressions);
    }
    function buildFunction(ast) {
        currentFunctionParams = new Set();
        pluralsStack = [];
        const body = ast.length === 1
            ? buildCallExpression(ast[0])
            : buildTemplateLiteral(ast);
        return types.arrowFunctionExpression(Array.from(currentFunctionParams)
            .sort()
            .map((p) => types.identifier(p)), body);
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
                        const importDeclaration = types.importDeclaration(Array.from(usedHelpers)
                            .sort()
                            .map((name) => types.importSpecifier(types.identifier(name), types.identifier(name))), types.stringLiteral("svelte-compile-intl"));
                        path.unshiftContainer("body", importDeclaration);
                    }
                },
            },
            CallExpression({ node }) {
                if (types.isIdentifier(node.callee) && node.callee.name === "_") {
                    if (node.arguments?.length >= 1 &&
                        types.isStringLiteral(node.arguments[0])) {
                        const messageId = node.arguments[0].value;
                        const translatedMessage = translations.get(messageId);
                        const icuAST = parse(translatedMessage);
                        if (icuAST.length === 1 && icuAST[0].type === 0) {
                            node.arguments[0] = types.stringLiteral(translatedMessage);
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

export default babelCompileIntlPlugin;
//# sourceMappingURL=babel-plugin.es.js.map
