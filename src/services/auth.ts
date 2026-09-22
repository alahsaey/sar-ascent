import { AdminUser, AdminRole, AdminPermissions } from '../types';
import { getAdminUsers, updateAdminUser, recordAuditLog } from './db';
import { securityFirewall } from './security';

const SESSION_KEY = 'permit_admin_session_v1';

export interface AdminSession {
  user: AdminUser;
  token: string;
  expiresAt: string;
}

// SHA-256 for consistent password hashing
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Login admin using email and either Password OR Secret PIN Code.
 * Enforces anti-brute force firewall lockout.
 */
export async function loginAdmin(
  emailOrIdentifier: string,
  secretInput: string,
  authType: 'password' | 'pin' | 'any' = 'any'
): Promise<AdminUser> {
  // 1. Check Firewall Lockout
  const lockStatus = securityFirewall.checkAdminLoginStatus();
  if (!lockStatus.allowed) {
    throw new Error(lockStatus.message || 'تم حظر محاولات الدخول مؤقتاً لحماية النظام.');
  }

  const admins = await getAdminUsers();
  const normalizedInput = emailOrIdentifier.trim().toLowerCase();
  const trimmedSecret = secretInput.trim();

  if (!normalizedInput || !trimmedSecret) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور أو الرقم السري.');
  }

  // Find admin by email or name
  const admin = admins.find(
    a => a.email.toLowerCase() === normalizedInput || a.id.toLowerCase() === normalizedInput
  );

  if (!admin) {
    const failRecord = securityFirewall.recordFailedAdminLogin();
    await recordAuditLog({
      adminId: 'UNKNOWN',
      adminName: 'مجهول (محاولة غير مصرح بها)',
      action: 'فشل محاولة تسجيل دخول',
      entityType: 'SECURITY_ALERT',
      entityId: normalizedInput,
      details: `محاولة دخول بهوية غير مسجلة: ${normalizedInput}`,
      createdAt: new Date().toISOString()
    }).catch(() => {});
    
    if (failRecord.isLocked) {
      throw new Error('جدار الحماية: تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم قفل النظام لمدة 5 دقائق.');
    }
    throw new Error(`بيانات الدخول غير صحيحة. متبقي لديك ${failRecord.attemptsRemaining} محاولات قبل القفل المؤقت.`);
  }

  if (admin.status === 'suspended') {
    throw new Error('تم تعطيل هذا الحساب. يرجى مراجعة إدارة النظام.');
  }

  // Verify secret: check PIN code or Password Hash strictly against registered user
  let isValid = false;

  // 1. PIN code verification (if provided as PIN or matching secret)
  if (admin.pinCode && admin.pinCode === trimmedSecret) {
    isValid = true;
  }

  // 2. Hash verification
  if (!isValid && admin.passwordHash) {
    const inputHash = await sha256(trimmedSecret);
    if (admin.passwordHash === inputHash) {
      isValid = true;
    }
  }

  if (!isValid) {
    const failRecord = securityFirewall.recordFailedAdminLogin();
    await recordAuditLog({
      adminId: admin.id,
      adminName: admin.name,
      action: 'فشل إدخال كلمة المرور / الرمز السري',
      entityType: 'SECURITY_ALERT',
      entityId: admin.id,
      details: `محاولة غير ناجحة لإدخال الرمز السري للحساب ${admin.email}`,
      createdAt: new Date().toISOString()
    }).catch(() => {});

    if (failRecord.isLocked) {
      throw new Error('جدار الحماية: تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم قفل النظام لمدة 5 دقائق.');
    }
    throw new Error(`الرقم السري أو كلمة المرور غير صحيحة. متبقي ${failRecord.attemptsRemaining} محاولات.`);
  }

  // Reset failed login counter on success
  securityFirewall.resetFailedAdminLogins();

  // Update last login
  const now = new Date().toISOString();
  try {
    await updateAdminUser(admin.id, { lastLoginAt: now });
    admin.lastLoginAt = now;
  } catch {
    // Continue
  }

  const session: AdminSession = {
    user: admin,
    token: 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  await recordAuditLog({
    adminId: admin.id,
    adminName: admin.name,
    action: 'تسجيل دخول لوحة التحكم',
    entityType: 'SESSION',
    entityId: admin.id,
    details: `تم تسجيل الدخول بنجاح بواسطة ${authType === 'pin' ? 'الرقم السري' : 'بيانات الاعتماد الرسمية'}.`,
    createdAt: now
  });

  return admin;
}

/**
 * Direct PIN Login (e.g. by selecting or entering authorized administrator PIN)
 */
export async function loginWithPinOnly(pinCode: string): Promise<AdminUser> {
  const admins = await getAdminUsers();
  const trimmedPin = pinCode.trim();

  if (!trimmedPin) {
    throw new Error('يرجى إدخال الرقم السري للتحقق.');
  }

  const admin = admins.find(a => a.pinCode === trimmedPin && a.status === 'active');

  if (!admin) {
    throw new Error('الرقم السري المدخل غير مصرح له بالدخول.');
  }

  const now = new Date().toISOString();
  try {
    await updateAdminUser(admin.id, { lastLoginAt: now });
    admin.lastLoginAt = now;
  } catch {
    // Continue
  }

  const session: AdminSession = {
    user: admin,
    token: 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  await recordAuditLog({
    adminId: admin.id,
    adminName: admin.name,
    action: 'تسجيل دخول بالرقم السري',
    entityType: 'SESSION',
    entityId: admin.id,
    details: `تم التحقق والدخول المباشر بالرقم السري للمسؤول (${admin.name}).`,
    createdAt: now
  });

  return admin;
}

export function getCurrentAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AdminSession = JSON.parse(raw);
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      logoutAdmin();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function logoutAdmin(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isSuperAdmin(user?: AdminUser | null): boolean {
  return user?.role === 'super_admin';
}

export function hasPermission(
  user: AdminUser | null | undefined,
  permission: keyof AdminPermissions
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.permissions && user.permissions[permission]) return true;
  return false;
}

export function canApproveLists(user?: AdminUser | null): boolean {
  return hasPermission(user, 'canApproveLists');
}

export function canUploadLists(user?: AdminUser | null): boolean {
  return hasPermission(user, 'canUploadLists');
}

export function canDeleteLists(user?: AdminUser | null): boolean {
  return hasPermission(user, 'canDeleteLists');
}

export function canManageAdmins(user?: AdminUser | null): boolean {
  return hasPermission(user, 'canManageAdmins');
}

export function canViewAuditLogs(user?: AdminUser | null): boolean {
  return hasPermission(user, 'canViewAuditLogs');
}

export function canExportLogs(user?: AdminUser | null): boolean {
  return hasPermission(user, 'canExportLogs');
}
