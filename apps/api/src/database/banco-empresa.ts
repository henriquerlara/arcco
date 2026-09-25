/** Por enquanto toda empresa operacional usa este único database. */
export const BANCO_EMPRESA_UNICO = {
  host: 'localhost',
  port: 5432,
  name: 'db_empresa_arcco',
} as const;
