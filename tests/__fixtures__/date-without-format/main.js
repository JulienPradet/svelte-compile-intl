import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("{today, date}", {
    today: new Date(),
  })
);
