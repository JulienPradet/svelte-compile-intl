/* eslint-disable @typescript-eslint/no-explicit-any */
function monadicMemoize<
  ResultFn extends (this: any, ...newArgs: any[]) => ReturnType<ResultFn>
>(fn: ResultFn): ResultFn {
  const cache = Object.create(null);
  function memoizedFn(this: any, ...newArgs: any[]): ReturnType<ResultFn> {
    const cacheKey = JSON.stringify(newArgs);
    if (cacheKey in cache) {
      return cache[cacheKey];
    }
    return (cache[cacheKey] = fn(...newArgs));
  }

  return memoizedFn as ResultFn;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let locale: string | null = null;
let formats: {
  number: Record<string, Intl.NumberFormatOptions>;
  date: Record<string, Intl.DateTimeFormatOptions>;
  time: Record<string, Intl.DateTimeFormatOptions>;
} = {
  number: {},
  date: {},
  time: {},
};
export const getCurrentLocale = (): string => locale || "en-GB";
export const setCurrentLocale = (
  newLocale: string,
  newFormats: {
    number: Record<string, Intl.NumberFormatOptions>;
    date: Record<string, Intl.DateTimeFormatOptions>;
    time: Record<string, Intl.DateTimeFormatOptions>;
  }
): void => {
  locale = newLocale;
  formats = newFormats;
};

function getOptions<T>(
  format: string | T = "default",
  options: Record<string, T>
): T {
  const result = typeof format === "string" ? options[format] : format;
  if (!result) {
    throw new Error(`Invalid format ${format}`);
  }
  return result;
}

const getNumberFormat = monadicMemoize(
  ({
    locale,
    options,
  }: {
    locale: string;
    options: Intl.NumberFormatOptions;
  }): Intl.NumberFormat => {
    return new Intl.NumberFormat(locale, options);
  }
);
export const formatNumber = (
  value: number,
  format: Intl.NumberFormatOptions | string
): string => {
  const locale = getCurrentLocale();
  return getNumberFormat({
    locale,
    options: getOptions<Intl.NumberFormatOptions>(format, formats.number),
  }).format(value);
};

const getDateTimeFormat = monadicMemoize(({ locale, options }) => {
  return new Intl.DateTimeFormat(locale, options);
});
export const formatDate = (
  value: number | Date | undefined,
  format: Intl.DateTimeFormatOptions | string
): string => {
  const locale = getCurrentLocale();
  return getDateTimeFormat({
    locale,
    options: getOptions<Intl.DateTimeFormatOptions>(format, formats.date),
  }).format(value);
};

export const formatTime = (
  value: number | Date | undefined,
  format: Intl.DateTimeFormatOptions | string
): string => {
  const locale = getCurrentLocale();
  return getDateTimeFormat({
    locale,
    options: getOptions<Intl.DateTimeFormatOptions>(format, formats.time),
  }).format(value);
};

export function __interpolate(value: number | string | undefined): string {
  return value === 0 ? "0" : value?.toString() || "";
}

const getPluralRules = monadicMemoize((locale) => {
  return new Intl.PluralRules(locale);
});
function getLocalPluralFor(value: number) {
  const locale = getCurrentLocale();
  const pluralRules = getPluralRules(locale);
  const key = pluralRules.select(value);
  return key === "other" ? "h" : key[0];
}

export function __plural(value: number, opts: Record<string, string>): string {
  return opts[value] || opts[getLocalPluralFor(value)] || "";
}

export function __select(value: number, opts: Record<string, string>): string {
  return opts[value] || opts["other"] || "";
}

export function __number(value: number, format: string): string {
  return formatNumber(value, format);
}

export function __date(
  value: number | Date | undefined,
  format: string
): string {
  return formatDate(value, format);
}

export function __time(
  value: number | Date | undefined,
  format: string
): string {
  return formatTime(value, format);
}

export function format(
  // eslint-disable-next-line
  message: string | Function,
  options: Record<string, string>
): string {
  return typeof message === "string"
    ? message
    : message(
        ...Object.keys(options || {})
          .sort()
          .map((k) => options[k])
      );
}

export { format as _ };
