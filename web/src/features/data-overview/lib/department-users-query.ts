export const DEPARTMENT_USERS_INITIAL_PAGE_SIZE = 10
export const DEPARTMENT_USERS_INITIAL_SORT_BY = 'sub_quota_used'
export const DEPARTMENT_USERS_INITIAL_SORT_ORDER = 'desc'

interface DepartmentUsersQueryState {
  pageIndex: number
  pageSize: number
  sortBy: string
  sortOrder: string
  registrationStatus?: string
  role?: string
}

export function isInitialDepartmentUsersQuery(
  query: DepartmentUsersQueryState
): boolean {
  return (
    query.pageIndex === 0 &&
    query.pageSize === DEPARTMENT_USERS_INITIAL_PAGE_SIZE &&
    query.sortBy === DEPARTMENT_USERS_INITIAL_SORT_BY &&
    query.sortOrder === DEPARTMENT_USERS_INITIAL_SORT_ORDER &&
    !query.registrationStatus &&
    !query.role
  )
}
