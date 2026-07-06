export function resolveProfileSource(dashboard: any) {
  const { userProfile, operatorInfo } = dashboard || {};

  if (operatorInfo) {
    const fullName = [operatorInfo.name, operatorInfo.firstName, operatorInfo.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = operatorInfo.firstName || nameParts[0] || userProfile?.firstName || '';
    const lastName = operatorInfo.lastName || nameParts.slice(1).join(' ') || userProfile?.lastName || '';
    const region = operatorInfo.region || operatorInfo.regionId || userProfile?.region || '';

    return {
      profile: {
        ...(userProfile || {}),
        ...(operatorInfo || {}),
        firstName,
        lastName,
        phoneNumber: operatorInfo.phoneNumber || operatorInfo.phone || userProfile?.phoneNumber || userProfile?.phone || '',
        email: operatorInfo.email || userProfile?.email || '',
        branch: operatorInfo.branch || (region ? [region] : userProfile?.branch || []),
        region,
      },
      isViewingOperator: Boolean(operatorInfo && userProfile?.role === 'company_admin'),
    };
  }

  return {
    profile: userProfile,
    isViewingOperator: false,
  };
}
