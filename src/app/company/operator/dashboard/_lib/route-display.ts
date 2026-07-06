export function getVisibleAssignedRoutes(routes: Array<any>, profile: any) {
  const operatorBranches = Array.isArray(profile?.branch)
    ? profile.branch.filter(Boolean).map((branch: string) => String(branch).toLowerCase())
    : [];
  const operatorRegion = profile?.region ? String(profile.region).toLowerCase() : '';

  return (routes || []).filter((route: any) => {
    if (!route) return false;

    const routeRegion = route.regionId || route.region || route.branchId || route.branch;
    if (!routeRegion) {
      return true;
    }

    const normalizedRouteRegion = String(routeRegion).toLowerCase();
    if (!operatorRegion && operatorBranches.length === 0) {
      return true;
    }

    return normalizedRouteRegion === operatorRegion || operatorBranches.includes(normalizedRouteRegion);
  });
}
