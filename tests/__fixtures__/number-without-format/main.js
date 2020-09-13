import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("{quantity, number}", {
    quantity: "5",
  })
);
