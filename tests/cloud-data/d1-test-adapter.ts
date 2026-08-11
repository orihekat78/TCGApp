import type { DatabaseSync } from "node:sqlite";
import type {
  D1AllResultLike,
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1RunResultLike,
} from "../../src/cloud-data/d1-types";

class SqliteD1Statement implements D1PreparedStatementLike {
  constructor(
    private readonly database: DatabaseSync,
    private readonly query: string,
    private readonly values: readonly unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new SqliteD1Statement(this.database, this.query, values);
  }

  async first<T>(): Promise<T | null> {
    return (this.database.prepare(this.query).get(...this.values) as T) ?? null;
  }

  async all<T>(): Promise<D1AllResultLike<T>> {
    return {
      success: true,
      results: this.database.prepare(this.query).all(...this.values) as T[],
    };
  }

  async run(): Promise<D1RunResultLike> {
    const result = this.database.prepare(this.query).run(...this.values);
    return { success: true, meta: { changes: result.changes } };
  }
}

export class SqliteD1Database implements D1DatabaseLike {
  constructor(private readonly database: DatabaseSync) {}

  prepare(query: string): D1PreparedStatementLike {
    return new SqliteD1Statement(this.database, query);
  }
}
