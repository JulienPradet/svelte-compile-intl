const test = require("tape");
const {
  _,
  __interpolate,
  __plural,
  __select,
  __number,
  __date,
  __time,
  setCurrentLocale,
} = require("../");

test("svelte-compile-intl", (t) => {
  t.test("should return literals without any change", async (t) => {
    t.equal(_("Chaine de traduction"), "Chaine de traduction");
  });

  t.test("should correctly parse plurals", async (t) => {
    t.equal(
      _(
        (quantity) =>
          __plural(quantity, {
            0: "aucun",
            1: "un \\xE9l\\xE9ment",
            h: "".concat(quantity, " \\xE9l\\xE9ments"),
          }),
        {
          quantity: 5,
        }
      ),
      "5 \\xE9l\\xE9ments"
    );
  });

  t.test("should correctly parse selects", async (t) => {
    t.equal(
      _(
        (fruit) =>
          __select(fruit, {
            apple: "Super pomme",
            banana: "Banane top",
          }),
        {
          fruit: "apple",
        }
      ),
      "Super pomme"
    );
  });

  t.test("should correctly parse numbers", async (t) => {
    setCurrentLocale("fr-FR", {
      number: {
        price: {
          style: "currency",
          currency: "EUR",
        },
      },
    });
    t.equal(
      _((quantity) => __number(quantity, "price"), {
        quantity: "5",
      }),
      "5,00 €"
    );
  });

  t.test(
    'should correctly parse numbers without format and use the "default" format instead',
    async (t) => {
      setCurrentLocale("fr-FR", {
        number: {
          default: {
            style: "currency",
            currency: "EUR",
          },
        },
      });

      t.equal(
        _((quantity) => __number(quantity), {
          quantity: "5",
        }),
        "5,00 €"
      );
    }
  );

  t.test("should correctly parse dates", async (t) => {
    setCurrentLocale("fr-FR", {
      date: {
        short: {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
      },
    });

    t.equal(
      _((today) => __date(today, "short"), {
        today: new Date("2020-09-13"),
      }),
      "13 sept. 2020"
    );
  });

  t.test("should correctly parse dates without format", async (t) => {
    setCurrentLocale("fr-FR", {
      date: {
        default: {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
      },
    });
    t.equal(
      _((today) => __date(today), {
        today: new Date("2020-09-13"),
      }),
      "13 sept. 2020"
    );
  });

  t.test("should correctly parse times", async (t) => {
    setCurrentLocale("fr-FR", {
      time: {
        short: {
          hour: "numeric",
          minute: "numeric",
        },
      },
    });

    t.equal(
      _((today) => __time(today, "short"), {
        today: new Date("2020-09-13 15:33:37"),
      }),
      "15:33"
    );
  });

  t.test("should correctly parse times without format", async (t) => {
    setCurrentLocale("fr-FR", {
      time: {
        default: {
          hour: "numeric",
          minute: "numeric",
        },
      },
    });

    t.equal(
      _((today) => __time(today), {
        today: new Date("2020-09-13 15:33:37"),
      }),
      "15:33"
    );
  });

  t.test("should correctly parse times without format", async (t) => {
    t.equal(
      _(
        (order, quantity, values) =>
          "My super translation "
            .concat(
              __plural(quantity, {
                0: "0",
                h: quantity,
              }),
              " with multiple "
            )
            .concat(__interpolate(values), " with weird ")
            .concat(__interpolate(order)),
        {
          quantity: 5,
          values: "values",
          order: "order",
        }
      ),
      "My super translation 5 with multiple values with weird order"
    );
  });
});
