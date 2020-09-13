import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("{today, time, short}", {
    today: new Date(),
  })
);
