/**
 * Drizzle روی `node:sqlite` (ماژول داخلی نود).
 * drizzle-orm 0.45 درایور رسمی برای node:sqlite ندارد و گزینه‌های موجود
 * (better-sqlite3 / bun-sqlite) یا به پکیج native نیاز دارند یا به runtime بان.
 * این shim همان الگوی `drizzle-orm/better-sqlite3/session.js` را روی API
 * عمومی `drizzle-orm/sqlite-core` پیاده می‌کند؛ رفتار SYNCC و بدون رشته‌گساست.
 */
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { NoopCache } from 'drizzle-orm/cache/core';
import type { Cache } from 'drizzle-orm/cache/core';
import type { WithCacheConfig } from 'drizzle-orm/cache/core/types';
import { NoopLogger, type Logger } from 'drizzle-orm/logger';
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
} from 'drizzle-orm/relations';
import { fillPlaceholders, sql, type Query } from 'drizzle-orm/sql';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core/db';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core/dialect';
import type { SelectedFieldsOrdered } from 'drizzle-orm/sqlite-core/query-builders/select.types';
import {
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteTransaction,
  type SQLiteExecuteMethod,
  type SQLiteTransactionConfig,
} from 'drizzle-orm/sqlite-core/session';
import * as drizzleUtils from 'drizzle-orm/utils';

type RunResult = { changes: number | bigint; lastInsertRowid: number | bigint };

// mapResultRow در زمان اجرا از drizzle-orm/utils صادر می‌شود ولی در .d.ts اعلام نشده
const mapResultRow = (
  drizzleUtils as unknown as {
    mapResultRow: (
      columns: SelectedFieldsOrdered,
      row: unknown[],
      joinsNotNullableMap: Record<string, boolean> | undefined,
    ) => Record<string, unknown>;
  }
).mapResultRow;

type SchemaConfig<TSchema extends TablesRelationalConfig> = RelationalSchemaConfig<TSchema>;

class NodeSQLitePreparedQuery extends SQLitePreparedQuery<{
  type: 'sync';
  run: RunResult;
  all: unknown[];
  get: unknown;
  values: unknown[][];
  execute: unknown;
}> {
  // این فیلد را خود builder ست می‌کند: query.joinsNotNullableMap = ...
  /** @internal */
  joinsNotNullableMap?: Record<string, boolean>;

  constructor(
    private stmt: StatementSync,
    query: Query,
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private _isResponseInArrayMode: boolean,
    private customResultMapper?: (rows: unknown[][]) => unknown,
    cache?: Cache,
    queryMetadata?: { type: 'select' | 'update' | 'delete' | 'insert'; tables: string[] },
    cacheConfig?: WithCacheConfig,
  ) {
    super('sync', executeMethod, query, cache, queryMetadata, cacheConfig);
  }

  private params(placeholderValues?: Record<string, unknown>) {
    const filled = fillPlaceholders(this.query.params, placeholderValues ?? {});
    // مقدار undefined که ممکن است از builder بیاید، node:sqlite قبول نمی‌کند
    const params = filled.map((value) => value ?? null) as SQLInputValue[];
    this.logger.logQuery(this.query.sql, params);
    return params;
  }

  /** سطرها به‌صورت آرایه‌ی ستون‌ها (معادل raw() در better-sqlite3) */
  private rawAll(params: SQLInputValue[]) {
    this.stmt.setReturnArrays(true);
    try {
      return this.stmt.all(...params) as unknown as unknown[][];
    } finally {
      this.stmt.setReturnArrays(false);
    }
  }

  private rawGet(params: SQLInputValue[]) {
    this.stmt.setReturnArrays(true);
    try {
      return this.stmt.get(...params) as unknown as unknown[] | undefined;
    } finally {
      this.stmt.setReturnArrays(false);
    }
  }

  run(placeholderValues?: Record<string, unknown>): RunResult {
    return this.stmt.run(...this.params(placeholderValues)) as RunResult;
  }

  all(placeholderValues?: Record<string, unknown>): unknown[] {
    const { fields, joinsNotNullableMap, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      return this.stmt.all(...this.params(placeholderValues)) as unknown[];
    }
    const rows = this.values(placeholderValues);
    if (customResultMapper) return customResultMapper(rows) as unknown[];
    return rows.map((row) => mapResultRow(fields!, row, joinsNotNullableMap));
  }

  get(placeholderValues?: Record<string, unknown>): unknown {
    const params = this.params(placeholderValues);
    const { fields, joinsNotNullableMap, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      return this.stmt.get(...params);
    }
    const row = this.rawGet(params);
    if (!row) return undefined;
    if (customResultMapper) return customResultMapper([row]);
    return mapResultRow(fields!, row, joinsNotNullableMap);
  }

  values(placeholderValues?: Record<string, unknown>): unknown[][] {
    return this.rawAll(this.params(placeholderValues));
  }

  /** @internal */
  isResponseInArrayMode() {
    return this._isResponseInArrayMode;
  }
}

class NodeSQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<'sync', RunResult, TFullSchema, TSchema> {
  readonly nodeDialect: SQLiteSyncDialect;
  private client: DatabaseSync;
  private schema: SchemaConfig<TSchema> | undefined;
  private logger: Logger;
  private cache: Cache;

  constructor(
    client: DatabaseSync,
    dialect: SQLiteSyncDialect,
    schema: SchemaConfig<TSchema> | undefined,
    options: { logger?: Logger; cache?: Cache } = {},
  ) {
    super(dialect);
    this.client = client;
    this.nodeDialect = dialect;
    this.schema = schema;
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache ?? new NoopCache();
  }

  exec(query: string) {
    this.client.exec(query);
  }

  prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
    queryMetadata?: { type: 'select' | 'update' | 'delete' | 'insert'; tables: string[] },
    cacheConfig?: WithCacheConfig,
  ) {
    return new NodeSQLitePreparedQuery(
      this.client.prepare(query.sql),
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper,
      this.cache,
      queryMetadata,
      cacheConfig,
    );
  }

  transaction<T>(
    transaction: (tx: NodeSQLiteTransaction<TFullSchema, TSchema>) => T,
    config: SQLiteTransactionConfig = {},
  ): T {
    const tx = new NodeSQLiteTransaction<TFullSchema, TSchema>(
      this.nodeDialect,
      this,
      this.schema,
    );
    // node:sqlite متد transaction() ندارد؛ خودِ SQL را اجرا می‌کنیم
    this.client.exec(beginSql(config.behavior));
    try {
      const result = transaction(tx);
      this.client.exec('COMMIT');
      return result;
    } catch (err) {
      this.client.exec('ROLLBACK');
      throw err;
    }
  }
}

class NodeSQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<'sync', RunResult, TFullSchema, TSchema> {
  readonly nodeSession: NodeSQLiteSession<TFullSchema, TSchema>;
  private nodeDialect: SQLiteSyncDialect;

  constructor(
    dialect: SQLiteSyncDialect,
    session: NodeSQLiteSession<TFullSchema, TSchema>,
    schema: SchemaConfig<TSchema> | undefined,
    nestedIndex = 0,
  ) {
    super('sync', dialect, session, schema, nestedIndex);
    this.nodeDialect = dialect;
    this.nodeSession = session;
  }

  transaction<T>(transaction: (tx: NodeSQLiteTransaction<TFullSchema, TSchema>) => T): T {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new NodeSQLiteTransaction<TFullSchema, TSchema>(
      this.nodeDialect,
      this.nodeSession,
      this.schema,
      this.nestedIndex + 1,
    );
    this.nodeSession.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = transaction(tx);
      this.nodeSession.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      this.nodeSession.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
}

function beginSql(behavior: SQLiteTransactionConfig['behavior'] = 'deferred') {
  return behavior === 'deferred' ? 'BEGIN' : `BEGIN ${behavior.toUpperCase()}`;
}

export class NodeSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> extends BaseSQLiteDatabase<'sync', RunResult, TSchema> {}

export function drizzleNodeSQLite<TSchema extends Record<string, unknown> = Record<string, never>>(
  client: DatabaseSync,
  config: { schema?: TSchema; logger?: Logger } = {},
): NodeSQLiteDatabase<TSchema> {
  const dialect = new SQLiteSyncDialect();
  const tablesConfig = config.schema
    ? extractTablesRelationalConfig(config.schema, createTableRelationsHelpers)
    : undefined;
  const schemaConfig = tablesConfig
    ? {
        fullSchema: config.schema!,
        schema: tablesConfig.tables,
        tableNamesMap: tablesConfig.tableNamesMap,
      }
    : undefined;

  const session = new NodeSQLiteSession(client, dialect, schemaConfig as never, {
    logger: config.logger,
  });
  return new NodeSQLiteDatabase<TSchema>('sync', dialect, session as never, schemaConfig as never);
}
