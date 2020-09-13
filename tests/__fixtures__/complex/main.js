import { _, setCurrentLocale } from "svelte-compile-intl";

setCurrentLocale("fr-FR");
console.log(
  _(
    "My super translation {quantity, plural, =0 {0} other {#}} with multiple {values} with weird {order}",
    {
      quantity: 5,
      values: "values",
      order: "order",
    }
  )
);
