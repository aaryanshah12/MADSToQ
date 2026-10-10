/** Branded ID type for compile-time clarity without runtime cost */
export type EntityId = string & { readonly __brand: unique symbol };

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
