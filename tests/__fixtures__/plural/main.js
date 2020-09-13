import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");

console.log(
  _("{quantity, plural, =0 {none} =1 {one item} other {# items}}", {
    quantity: 5,
  })
);
