import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("{fruit, select, apple {Great apple} banana {Awesome banana}}", {
    fruit: "apple",
  })
);
