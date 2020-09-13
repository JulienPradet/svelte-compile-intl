export declare const getCurrentLocale: () => string;
export declare const setCurrentLocale: (newLocale: string, newFormats: {
    number: Record<string, Intl.NumberFormatOptions>;
    date: Record<string, Intl.DateTimeFormatOptions>;
    time: Record<string, Intl.DateTimeFormatOptions>;
}) => void;
export declare const formatNumber: (value: number, format: Intl.NumberFormatOptions | string) => string;
export declare const formatDate: (value: number | Date | undefined, format: Intl.DateTimeFormatOptions | string) => string;
export declare const formatTime: (value: number | Date | undefined, format: Intl.DateTimeFormatOptions | string) => string;
export declare function __interpolate(value: number | string | undefined): string;
export declare function __plural(value: number, opts: Record<string, string>): string;
export declare function __select(value: number, opts: Record<string, string>): string;
export declare function __number(value: number, format: string): string;
export declare function __date(value: number | Date | undefined, format: string): string;
export declare function __time(value: number | Date | undefined, format: string): string;
export declare function format(message: string | Function, options: Record<string, string>): string;
export { format as _ };
