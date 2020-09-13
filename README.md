# svelte-compile-intl

This project's goal is to provide the tools needed to add super lightweight translations using the [ICU format](https://formatjs.io/docs/intl-messageformat/) to your application. It is made with svelte in mind, but it could be used in other projects too by using the babel plugin directly.

Becareful though, if you are to use this project, this means that you need to understand how your current tooling works to export multiple bundle with different babel configurations. And your server/SSG should be aware of these different bundles in order to serve the correct bundle to your users.

## Related projects

If you are willing to add translations to your application but don't want to change too much your compilation pipeline, I suggest to have a look at [svelte-i18n](https://github.com/kaisermann/svelte-i18n) or [svelte-intl](https://github.com/Panya/svelte-intl) instead.

## Installation

Install `svelte-compile-intl` from github by using:

```sh
npm install --save JulienPradet/svelte-compile-intl
```

## Configure your pipeline

Change your tooling pipeline to run the compilation once for each language in your application. Once this is done, you can add the compilation from `svelte-comile-intl` either by:

- Using a rollup plugin (only if you don't already have Babel in your pipeline):

  ```diff
  // rollup.config.js
  + const path = require("path");

  module.exports = {
    input: "src/index.js",
    plugins: [
  +    rollupCompileIntlPlugin(
  +      "fr-FR",
  +      path.join(process.cwd(), `translations`)
  +    ),
    ],
  }
  ```

- Using the babel plugin directly (if Babel is already configured in your compilation tooling)

  ```diff
  + const path = require("path");

  module.exports = {
    presets: [
      [
        "@babel/preset-env",
        {
          targets: {
            esmodules: true,
          },
        },
      ],
  +    [
  +      "svelte-compile-intl/babel-plugin",
  +      {
  +          locale: "fr-FR",
  +          translationsFolder: path.join(process.cwd(), `translations`)
  +      }
  +    ]
    ],
  };
  ```

Once you've set it up, this means that you will have access to a `translations` folder at the root of your application that will be created on first compilation. It will then be updated each time a new translation is added. Once you've compiled your application in different languages, each locale will have its own JSON file in this folder.

## Usage in your Svelte application

At the root of your application, define the current locale:

```js
import { setCurrentLocale } from "svelte-compile-intl";
setCurrentLocale("fr-FR");
```

However, since the locale should be different for each build, I either suggest you to use something like [@rollup/plugin-replace](https://github.com/rollup/plugins/tree/master/packages/replace) or by injecting a global variable from your server (`<script>window.locale = "fr-FR";</script>`).

Once this is done, you can declare new translations in your file like this:

```svelte
<script>
  import { _ } from "svelte-compile-intl";
</script>

<h1>{_("Hello world")}</h1>
```

You can then go to your `translations/fr-FR.json` file and set it like this:

```json
{
  "Hello world": "Bonjour le monde"
}
```

## Advanced usecases

### Call `_` in javascript

You can use the translation mechanism in your javascript too. You are not limited by svelte's features.

```svelte
<script>
  import { _ } from "svelte-compile-intl";
  const hello = _("Hello world")
</script>

<h1>{hello}</h1>
```

### Using other ICU formats

It is possible to use any kind of formats from the ICU standard. Please refer to [IntlMessageFormat](https://formatjs.io/docs/intl-messageformat/) for full details. But here is a short cheatsheet for the most common cases:

#### Plural

```js
_("{quantity, plural, =0 {none} =1 {one item} other {# items}}", {
  quantity: 5,
});
```

#### Number

```js
// In your main file, add the number formats you want to support
// Please refer to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat#Using_options for format details
import { setCurrentLocale } from "svelte-compile-intl";
setCurrentLocale("fr-FR", {
  number: {
    price: {
      style: "currency",
      currency: "EUR",
    },
  },
});

// In the file containing the translation, you can use the new format (here "price")
import { _ } from "svelte-compile-intl";
_("Your item will cost {priceValue, number, price}", {
  priceValue: 5,
});

// You can also use only the formatting directly
import { formatNumber } from "svelte-compile-intl";
formatNumber(new Date(), "short");
```

#### Date

```js
// In your main file, add the date formats you want to support
// Please refer to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat#Using_options for format details
import { setCurrentLocale } from "svelte-compile-intl";
setCurrentLocale("fr-FR", {
  date: {
    short: {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    },
  },
});

// In the file containing the translation, you can use the new format (here "short")
import { _ } from "svelte-compile-intl";
_("Today is {today, date, short}", {
  today: new Date(),
});

// You can also use only the formatting directly
import { formatDate } from "svelte-compile-intl";
formatDate(new Date(), "short");
```

#### Time

```js
// In your main file, add the time formats you want to support
// Please refer to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat#Using_options for format details
import { setCurrentLocale } from "svelte-compile-intl";
setCurrentLocale("fr-FR", {
  time: {
    short: {
      hour: "numeric",
      minute: "numeric",
    },
  },
});

// In the file containing the translation, you can use the new format (here "short")
import { _ } from "svelte-compile-intl";
_("It's {today, time, short}", {
  today: new Date(),
});

// You can also use only the formatting directly
import { formatTime } from "svelte-compile-intl";
formatTime(new Date(), "short");
```

## Polyfill

Some Intl APIs are not always available in Node or in some browsers. Please make sure to load the correct polyfills when needed. You can refer to [FormatJS's polyfills](https://formatjs.io/docs/polyfills/).

## Acknownledgement

This library is a slighlty different take from [@cibernox](https://github.com/cibernox)'s take on precompilation for [svelte-i18n](https://github.com/kaisermann/svelte-i18n). You can see his original PR here: https://github.com/kaisermann/svelte-i18n/pull/41

This work is also made possible thanks to the huge work of [@longlho](https://github.com/longlho) on [FormatJS](https://github.com/formatjs/formatjs) and more specifically by making the [parser](https://github.com/formatjs/formatjs/tree/main/packages/intl-messageformat-parser) available for other libraries.

And finally, in order to do this stuff at compile time, the svelte-compile-intl relies on [Babel](https://babeljs.io/) mostly.
