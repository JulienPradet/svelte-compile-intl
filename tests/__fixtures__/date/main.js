import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("{today, date, short}", {
    today: new Date(),
  })
);
