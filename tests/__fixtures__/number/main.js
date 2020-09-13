import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("My price: {quantity, number, price}", {
    quantity: "5",
  })
);
console.log(
  _("{quantity, number, price}", {
    quantity: "5",
  })
);
