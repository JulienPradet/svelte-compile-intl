import { _ } from "svelte-compile-intl";

export default () => {
  console.log(_("Translation string"));
  console.log(_("Hey!"));
};
