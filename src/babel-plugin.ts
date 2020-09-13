import { join } from "path";
import {
  BabelFileMetadata,
  PluginPass,
  PluginTarget,
  types as t,
  Visitor,
} from "@babel/core";
import {
  ArgumentElement,
  DateElement,
  LiteralElement,
  MessageFormatElement,
  NumberElement,
  parse,
  PluralElement,
  SimpleFormatElement,
  Skeleton,
  TimeElement,
  TYPE,
} from "intl-messageformat-parser";
import {
  readFile,
  writeFile,
  readFileSync,
  accessSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import chokidar from "chokidar";
import d from "debug";
import { access, mkdir } from "fs/promises";

declare module "@babel/core" {
  interface BabelFileMetadata {
    usesIntl: boolean;
  }
}

const debug = d("svelte-compile-intl");

const HELPERS_MAP: Record<TYPE, string> = {
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

type PluralAbbreviationsKey = "zero" | "one" | "two" | "few" | "many" | "other";
const PLURAL_ABBREVIATIONS: Record<PluralAbbreviationsKey, string> = {
  zero: "z",
  one: "o",
  two: "t",
  few: "f",
  many: "m",
  other: "h",
};

type TranslationManager = {
  close: () => void;
  get: (messageId: string) => string;
};

const translationManagers = new Map<string, TranslationManager>();
const getTranslationsManager = (
  locale: string,
  translationsFolder: string
): TranslationManager => {
  if (!translationManagers.has(locale)) {
    try {
      accessSync(translationsFolder);
    } catch {
      mkdirSync(translationsFolder);
    }

    const translationsFile = join(translationsFolder, `${locale}.json`);
    let rawMessages = "{}";
    try {
      rawMessages = readFileSync(translationsFile).toString();
    } catch (e) {
      writeFileSync(translationsFile, "{}");
      debug(
        `Creating new translations for locale ${locale} in ${JSON.stringify(
          translationsFile
        )}`
      );
    }

    let messages = JSON.parse(rawMessages);

    const readTranslations = () => {
      return new Promise((resolve, reject) => {
        readFile(translationsFile, (err, buffer) => {
          if (err) {
            console.error(
              `Failed to read translation for locale ${locale}. Does the file ${translationsFile} exist?`
            );
            reject(err);
            return;
          }

          messages = JSON.parse(buffer.toString());

          resolve();
        });
      });
    };

    let throttle: NodeJS.Timeout | null;
    const updateTranslations = (messages: Record<string, string>) => {
      if (throttle) {
        clearTimeout(throttle);
      }

      throttle = setTimeout(() => {
        throttle = null;
        new Promise((resolve) => {
          debug(`Updating translation file for ${locale}.`);
          writeFile(
            translationsFile,
            JSON.stringify(messages, null, 2),
            (error) => {
              if (error) {
                console.error(
                  `Failed to add missing translation for ${locale}.`
                );
                console.error(error);
                return;
              }

              resolve();
            }
          );
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
          debug(
            `New translation found for locale ${locale}: ${JSON.stringify(
              messageId
            )}`
          );
          updateTranslations(messages);
        }

        return messages[messageId];
      },
    });
  }

  return translationManagers.get(locale) as TranslationManager;
};

const resetTranslationManagers = () => {
  for (const [key, translations] of translationManagers.entries()) {
    translations.close();
    translationManagers.delete(key);
  }
};

const babelCompileIntlPlugin: PluginTarget = (api, options) => {
  const translations = getTranslationsManager(
    options.locale,
    options.translationsFolder
  );

  let usedHelpers: Set<string> = new Set();
  let currentFunctionParams: Set<string> = new Set();
  let pluralsStack: PluralElement[] = [];

  function normalizePluralKey(
    key: PluralAbbreviationsKey | string
  ): string | number {
    if (PLURAL_ABBREVIATIONS[key as PluralAbbreviationsKey]) {
      return PLURAL_ABBREVIATIONS[key as PluralAbbreviationsKey];
    }

    key = key.trim();
    const match = key.match(/^=(\d)/);
    if (match) return parseInt(match[1], 10);
    return key;
  }

  function normalizeKey(key: string): string | number {
    key = key.trim();
    const match = key.match(/^=(\d)/);
    if (match) return parseInt(match[1], 10);
    return key;
  }

  function buildCallExpression(
    entry: MessageFormatElement,
    parent?: MessageFormatElement
  ) {
    const fnName = HELPERS_MAP[entry.type];
    if (entry.type === TYPE.literal || entry.type === TYPE.tag) {
      throw new Error(
        "Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace."
      );
    }

    if (entry.type === TYPE.pound) {
      if (parent?.type === TYPE.plural) {
        return t.identifier(parent.value);
      }

      throw new Error(
        "Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace."
      );
    }

    if (entry.type === TYPE.plural && (entry as PluralElement).offset !== 0) {
      usedHelpers.add("__offsetPlural");
    } else if (fnName !== "none") {
      usedHelpers.add(fnName);
    }

    if (
      entry.type === TYPE.argument ||
      entry.type === TYPE.number ||
      entry.type === TYPE.date ||
      entry.type === TYPE.time
    ) {
      let callArgs: Array<t.Expression>;
      if (
        entry.type === TYPE.number ||
        entry.type === TYPE.date ||
        entry.type === TYPE.time
      ) {
        const element = entry as SimpleFormatElement<TYPE, Skeleton>;

        currentFunctionParams.add(element.value);
        callArgs = [t.identifier(element.value)];
        if (typeof element.style === "string") {
          callArgs.push(t.stringLiteral(element.style));
        } else if (element.style) {
          throw new Error(
            "Not implemented yet. Please open an issue in svelte-compile-intl with the message you are trying to translate and the following stacktrace."
          );
        }
      } else {
        const element = entry as ArgumentElement;

        callArgs = [t.identifier(element.value)];
      }
      return t.callExpression(t.identifier(fnName), callArgs);
    }

    if (entry.type === TYPE.plural) {
      pluralsStack.push(entry);
    }

    const options = t.objectExpression(
      Object.keys(entry.options).map((key) => {
        const objValueAST = entry.options[key].value;
        let objValue;
        if (objValueAST.length === 1 && objValueAST[0].type === TYPE.literal) {
          objValue = t.stringLiteral(objValueAST[0].value);
        } else {
          objValue =
            objValueAST.length === 1
              ? buildCallExpression(objValueAST[0], entry)
              : buildTemplateLiteral(objValueAST);
        }
        const normalizedKey =
          entry.type === TYPE.plural
            ? normalizePluralKey(key)
            : normalizeKey(key);
        return t.objectProperty(
          typeof normalizedKey === "number"
            ? t.numericLiteral(normalizedKey)
            : t.identifier(normalizedKey),
          objValue
        );
      })
    );

    if (entry.type === TYPE.plural) {
      pluralsStack.pop();
    }
    currentFunctionParams.add(entry.value);
    let fnIdentifier = t.identifier(fnName);
    const callArguments: t.Expression[] = [t.identifier(entry.value)];

    if (entry.type === TYPE.plural && entry.offset !== 0) {
      fnIdentifier = t.identifier("__offsetPlural");
      callArguments.push(t.numericLiteral(entry.offset));
    }
    callArguments.push(options);
    return t.callExpression(fnIdentifier, callArguments);
  }

  function buildTemplateLiteral(ast: MessageFormatElement[]) {
    const quasis = [];
    const expressions = [];
    for (let i = 0; i < ast.length; i++) {
      const entry = ast[i];
      switch (entry.type) {
        case 0: {
          // literal
          const literal = entry as LiteralElement;
          quasis.push(
            t.templateElement(
              { cooked: literal.value, raw: literal.value },
              i === ast.length - 1 // tail
            )
          );
          break;
        }
        case 1: {
          // intepolation
          const interpolation = entry as ArgumentElement;
          expressions.push(buildCallExpression(interpolation));
          currentFunctionParams.add(interpolation.value);
          if (i === 0)
            quasis.push(t.templateElement({ cooked: "", raw: "" }, false));
          break;
        }
        case 2: {
          // Number format
          const number = entry as NumberElement;
          expressions.push(buildCallExpression(number));
          currentFunctionParams.add(number.value);
          break;
        }
        case 3: {
          // Date format
          const date = entry as DateElement;
          expressions.push(buildCallExpression(date));
          currentFunctionParams.add(date.value);
          break;
        }
        case 4: {
          // Time format
          const time = entry as TimeElement;
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
            expressions.push(
              t.binaryExpression(
                "-",
                t.identifier(lastPlural.value),
                t.numericLiteral(lastPlural.offset)
              )
            );
          } else {
            expressions.push(t.identifier(lastPlural.value));
          }
          if (i === 0)
            quasis.push(t.templateElement({ cooked: "", raw: "" }, false));
          break;
        }
        default:
          console.error(
            "Unsupported entry type. Please open an issue in svelte-compile-intl."
          );
      }
      if (i === ast.length - 1 && entry.type !== 0) {
        quasis.push(t.templateElement({ cooked: "", raw: "" }, true));
      }
    }
    return t.templateLiteral(quasis, expressions);
  }

  function buildFunction(
    ast: MessageFormatElement[]
  ): t.ArrowFunctionExpression {
    currentFunctionParams = new Set();
    pluralsStack = [];
    const body =
      ast.length === 1
        ? buildCallExpression(ast[0])
        : buildTemplateLiteral(ast);

    return t.arrowFunctionExpression(
      Array.from(currentFunctionParams)
        .sort()
        .map((p) => t.identifier(p)),
      body
    );
  }

  return {
    visitor: {
      Program: {
        enter: () => {
          usedHelpers = new Set<string>();
        },
        exit(path) {
          ((this.file.metadata as unknown) as BabelFileMetadata).usesIntl =
            usedHelpers.size > 0;
          if (usedHelpers.size > 0) {
            const importDeclaration = t.importDeclaration(
              Array.from(usedHelpers)
                .sort()
                .map((name) =>
                  t.importSpecifier(t.identifier(name), t.identifier(name))
                ),
              t.stringLiteral("svelte-compile-intl")
            );
            path.unshiftContainer("body", importDeclaration);
          }
        },
      },
      CallExpression({ node }) {
        if (t.isIdentifier(node.callee) && node.callee.name === "_") {
          if (
            node.arguments?.length >= 1 &&
            t.isStringLiteral(node.arguments[0])
          ) {
            const messageId = node.arguments[0].value;
            const translatedMessage = translations.get(messageId);

            const icuAST = parse(translatedMessage);
            if (icuAST.length === 1 && icuAST[0].type === 0) {
              node.arguments[0] = t.stringLiteral(translatedMessage);
            } else {
              node.arguments[0] = buildFunction(icuAST);
            }
          }
        }
      },
    } as Visitor<PluginPass>,
    post: () => {
      resetTranslationManagers();
    },
  };
};

export default babelCompileIntlPlugin;
