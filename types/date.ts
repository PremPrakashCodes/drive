/** Anything a Drive timestamp can arrive as: Date, ISO string, or missing. */
export type DateInput = Date | string | number | null | undefined;

/** A valid Date, or `undefined` for missing/unparseable input. Never NaN. */
export type MaybeDate = Date | undefined;
