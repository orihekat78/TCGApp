export type D1RunResultLike = {
  success?: boolean;
  meta?: { changes?: number };
};

export type D1AllResultLike<T> = {
  success?: boolean;
  results?: T[];
};

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1AllResultLike<T>>;
  run(): Promise<D1RunResultLike>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}
