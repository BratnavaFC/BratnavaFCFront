/** Resultado paginado padrão do backend (PagedResultDto<T>). */
export interface PagedResult<T> {
    page: number;
    pageSize: number;
    total: number;
    items: T[];
}
