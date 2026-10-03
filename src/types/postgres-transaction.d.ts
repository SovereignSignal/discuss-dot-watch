import type postgres from 'postgres';

/**
 * postgres 3.4.8 defines TransactionSql using Omit<Sql, ...>, which drops
 * Sql's call signatures. Restore only the supported tagged-query signature;
 * connection-only methods remain unavailable inside a transaction.
 * The upstream master types now inherit a shared ISql interface instead.
 * Keep this compatibility augmentation until the pinned package includes it.
 */
declare module 'postgres' {
  interface TransactionSql<TTypes extends Record<string, unknown>> {
    <T extends readonly (object | undefined)[] = postgres.Row[]>(
      template: TemplateStringsArray,
      ...parameters: readonly postgres.ParameterOrFragment<TTypes[keyof TTypes]>[]
    ): postgres.PendingQuery<T>;
  }
}
