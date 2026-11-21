/**
 * Code reaches a deployment before its migration does: this project applies
 * migrations by hand, so between a release and the SQL Editor there is a
 * window where the application asks for a column the database has not got.
 * Postgres answers 42703 to a select, PostgREST answers PGRST204 to a write
 * whose body names an unknown column.
 *
 * A column that only carries a nicety — a page count, say — should not take
 * the storefront or the save button down with it during that window. Reads
 * fall back to the columns that do exist; writes go again without the field.
 * Both can be dropped once every database has the column.
 */
export function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code !== "42703" && code !== "PGRST204") return false;
  return typeof message === "string" && message.includes(column);
}

/** The same row to write, minus the column this database does not have. */
export function withoutColumn<T extends Record<string, unknown>>(
  payload: T,
  column: string,
): Omit<T, string> {
  const { [column]: _dropped, ...rest } = payload;
  return rest;
}

/**
 * Runs a write, and runs it once more without the column if that is what the
 * database objected to. The retry is safe because the first attempt wrote
 * nothing: the row was rejected before it was stored.
 */
export async function writeWithoutMissingColumn<T>(
  payload: Record<string, unknown>,
  column: string,
  run: (body: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  try {
    return await run(payload);
  } catch (error) {
    if (!isMissingColumnError(error, column)) throw error;
    return run(withoutColumn(payload, column));
  }
}
