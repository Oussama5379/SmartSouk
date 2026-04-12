const ADMIN_DASHBOARD_ROUTE_PREFIXES = [
  "/dashboard/products",
  "/dashboard/marketing",
  "/dashboard/recommendations",
  "/dashboard/tracking",
  "/dashboard/analytics",
  "/dashboard/settings",
] as const

export function isAdminDashboardRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false

  return ADMIN_DASHBOARD_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
