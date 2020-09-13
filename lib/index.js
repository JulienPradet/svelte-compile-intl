'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/* eslint-disable @typescript-eslint/no-explicit-any */
function monadicMemoize(fn) {
    const cache = Object.create(null);
    function memoizedFn(...newArgs) {
        const cacheKey = JSON.stringify(newArgs);
        if (cacheKey in cache) {
            return cache[cacheKey];
        }
        return (cache[cacheKey] = fn(...newArgs));
    }
    return memoizedFn;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
let locale = null;
let formats = {
    number: {},
    date: {},
    time: {},
};
const getCurrentLocale = () => locale || "en-GB";
const setCurrentLocale = (newLocale, newFormats) => {
    locale = newLocale;
    formats = newFormats;
};
function getOptions(format = "default", options) {
    const result = typeof format === "string" ? options[format] : format;
    if (!result) {
        throw new Error(`Invalid format ${format}`);
    }
    return result;
}
const getNumberFormat = monadicMemoize(({ locale, options, }) => {
    return new Intl.NumberFormat(locale, options);
});
const formatNumber = (value, format) => {
    const locale = getCurrentLocale();
    return getNumberFormat({
        locale,
        options: getOptions(format, formats.number),
    }).format(value);
};
const getDateTimeFormat = monadicMemoize(({ locale, options }) => {
    return new Intl.DateTimeFormat(locale, options);
});
const formatDate = (value, format) => {
    const locale = getCurrentLocale();
    return getDateTimeFormat({
        locale,
        options: getOptions(format, formats.date),
    }).format(value);
};
const formatTime = (value, format) => {
    const locale = getCurrentLocale();
    return getDateTimeFormat({
        locale,
        options: getOptions(format, formats.time),
    }).format(value);
};
function __interpolate(value) {
    return value === 0 ? "0" : value?.toString() || "";
}
const getPluralRules = monadicMemoize((locale) => {
    return new Intl.PluralRules(locale);
});
function getLocalPluralFor(value) {
    const locale = getCurrentLocale();
    const pluralRules = getPluralRules(locale);
    const key = pluralRules.select(value);
    return key === "other" ? "h" : key[0];
}
function __plural(value, opts) {
    return opts[value] || opts[getLocalPluralFor(value)] || "";
}
function __select(value, opts) {
    return opts[value] || opts["other"] || "";
}
function __number(value, format) {
    return formatNumber(value, format);
}
function __date(value, format) {
    return formatDate(value, format);
}
function __time(value, format) {
    return formatTime(value, format);
}
function format(
// eslint-disable-next-line
message, options) {
    return typeof message === "string"
        ? message
        : message(...Object.keys(options || {})
            .sort()
            .map((k) => options[k]));
}

exports._ = format;
exports.__date = __date;
exports.__interpolate = __interpolate;
exports.__number = __number;
exports.__plural = __plural;
exports.__select = __select;
exports.__time = __time;
exports.format = format;
exports.formatDate = formatDate;
exports.formatNumber = formatNumber;
exports.formatTime = formatTime;
exports.getCurrentLocale = getCurrentLocale;
exports.setCurrentLocale = setCurrentLocale;
//# sourceMappingURL=index.js.map
