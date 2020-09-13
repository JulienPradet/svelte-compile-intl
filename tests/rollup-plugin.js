const test = require("tape");
const { readFile, writeFile, unlink, rmdir } = require("fs/promises");
const { join } = require("path");
const { rollup } = require("rollup");
const rollupCompileIntlPlugin = require("../rollup-plugin");
const babelCompileIntlPlugin = require("../babel-plugin");
const { stripIndent } = require("common-tags");

function onwarn(warning) {
  // eslint-disable-next-line no-console
  console.warn(warning.toString());
}

const getCode = async (folder) => {
  const bundle = await rollup({
    input: join(__dirname, `__fixtures__/${folder}/main.js`),
    output: {
      file: "bundle.js",
      format: "cjs",
    },
    external: ["svelte-compile-intl"],
    plugins: [
      rollupCompileIntlPlugin(
        "fr-FR",
        join(__dirname, `__fixtures__/${folder}/translations`)
      ),
    ],
  });

  const result = await bundle.write({
    dir: join(__dirname, `__fixtures__/${folder}/dist/`),
    format: "esm",
    exports: "named",
  });

  const buffer = await readFile(
    join(__dirname, `__fixtures__/${folder}/dist/main.js`)
  );

  return buffer.toString();
};

const getTranslations = async (folder) => {
  const buffer = await readFile(
    join(__dirname, `__fixtures__/${folder}/translations/fr-FR.json`)
  );

  return JSON.parse(buffer.toString());
};

const wait = (time) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
};

test("rollup-plugin", (t) => {
  t.test(
    "should replace translatable strings with the correct language",
    async (t) => {
      const code = await getCode("basic");

      t.match(code, /Chaine de traduction/);
    }
  );

  t.test("translation types", (t) => {
    t.test("should correctly parse plurals", async (t) => {
      const code = await getCode("plural");

      t.ok(
        code.includes(
          stripIndent`
          _(quantity => __plural(quantity, {
            0: "aucun",
            1: "un \\xE9l\\xE9ment",
            h: "".concat(quantity, " \\xE9l\\xE9ments")
          }), {
            quantity: 5
          })
          `
        )
      );
    });

    t.test("should correctly parse selects", async (t) => {
      const code = await getCode("select");

      t.ok(
        code.includes(
          stripIndent`
          _(fruit => __select(fruit, {
            apple: "Super pomme",
            banana: "Banane top"
          }), {
            fruit: "apple"
          })
          `
        )
      );
    });

    t.test("should correctly parse numbers", async (t) => {
      const code = await getCode("number");

      t.ok(
        code.includes(
          stripIndent`
          _(quantity => __number(quantity, "price"), {
            quantity: "5"
          })
          `
        )
      );
    });

    t.test("should correctly parse numbers without format", async (t) => {
      const code = await getCode("number-without-format");

      t.ok(
        code.includes(
          stripIndent`
          _(quantity => __number(quantity), {
            quantity: "5"
          })
          `
        )
      );
    });

    t.test("should correctly parse dates", async (t) => {
      const code = await getCode("date");

      t.ok(
        code.includes(
          stripIndent`
          _(today => __date(today, "short"), {
            today: new Date()
          })
          `
        )
      );
    });

    t.test("should correctly parse dates without format", async (t) => {
      const code = await getCode("date-without-format");

      t.ok(
        code.includes(
          stripIndent`
          _(today => __date(today), {
            today: new Date()
          })
          `
        )
      );
    });

    t.test("should correctly parse times", async (t) => {
      const code = await getCode("time");

      t.ok(
        code.includes(
          stripIndent`
          _(today => __time(today, "short"), {
            today: new Date()
          })
          `
        )
      );
    });

    t.test("should correctly parse times without format", async (t) => {
      const code = await getCode("time-without-format");

      t.ok(
        code.includes(
          stripIndent`
          _(today => __time(today), {
            today: new Date()
          })
          `
        )
      );
    });
  });

  t.test(
    "should allow multiple interpolation within the same translation",
    async (t) => {
      const code = await getCode("complex");

      t.ok(
        code.includes(
          stripIndent`
            _((order, quantity, values) => "My super translation ".concat(__plural(quantity, {
              0: "0",
              h: quantity
            }), " with multiple ").concat(__interpolate(values), " with weird ").concat(__interpolate(order)), {
              quantity: 5,
              values: "values",
              order: "order"
            })
          `
        )
      );
    }
  );

  t.test(
    "should replace translatable strings in deeper imports too",
    async (t) => {
      const code = await getCode("withinNestedImports");

      t.match(code, /Chaine de traduction/);
    }
  );

  t.test("missing translations", (t) => {
    t.test(
      "should leave the default translation when it's missing and add the new message to the translation file",
      async (t) => {
        await writeFile(
          join(
            __dirname,
            "__fixtures__/withMissingTranslation/translations/fr-FR.json"
          ),
          "{}"
        );

        const code = await getCode("withMissingTranslation");
        t.match(code, /Translation string/);

        await wait(500);

        const translations = await getTranslations("withMissingTranslation");
        t.equal(translations["Translation string"], "Translation string");
      }
    );

    t.test("should create the translation file if it's missing", async (t) => {
      try {
        await unlink(
          join(
            __dirname,
            "__fixtures__/withMissingTranslationFile/translations/fr-FR.json"
          )
        );
        await rmdir(
          join(
            __dirname,
            "__fixtures__/withMissingTranslationFile/translations"
          )
        );
      } catch {}

      await getCode("withMissingTranslationFile");

      await wait(500);

      const translations = await getTranslations("withMissingTranslationFile");
      t.equal(translations["Translation string"], "Translation string");
    });

    t.test("should replace all the available strings", async (t) => {
      const code = await getCode("withMultipleTranslations");

      t.match(code, /Chaine de traduction/);
      t.match(code, /Hey !/);
    });

    t.test("should add all the translations missing", async (t) => {
      const code = await getCode("withMultipleTranslationsMissing");

      await wait(500);

      const translations = await getTranslations(
        "withMultipleTranslationsMissing"
      );
      t.deepEqual(translations, {
        "Translation string": "Translation string",
        "Hey!": "Hey!",
      });
    });
  });
});
