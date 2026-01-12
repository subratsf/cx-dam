import { PermissionLevel } from '../types/user.types';

export const REQUIRED_ORG = 'salesforcedocs';

export const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  [PermissionLevel.VIEWER]: 0,
  [PermissionLevel.CONTRIBUTOR]: 1,
  [PermissionLevel.MAINTAINER]: 2,
  [PermissionLevel.ADMIN]: 3,
};

export function hasPermission(
  userPermission: PermissionLevel,
  requiredPermission: PermissionLevel
): boolean {
  return PERMISSION_HIERARCHY[userPermission] >= PERMISSION_HIERARCHY[requiredPermission];
}

export function canUploadAsset(permission: PermissionLevel): boolean {
  return hasPermission(permission, PermissionLevel.CONTRIBUTOR);
}

export function canReplaceAsset(permission: PermissionLevel, belongsToOrg: boolean): boolean {
  return belongsToOrg && hasPermission(permission, PermissionLevel.MAINTAINER);
}

export function canDeleteAsset(permission: PermissionLevel): boolean {
  return hasPermission(permission, PermissionLevel.MAINTAINER);
}
