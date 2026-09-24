import { AdminUser, AdminRole, AdminPermissions } from '../types';
import { getAdminUsers, updateAdminUser, recordAuditLog } from './db';
import {
  securityFirewall,
  sha256,
  verifyPinSecret,
  verifyAdminIntegrity,
  secureAdminRecord
} from './security';

const SESSION_KEY = 'permit_admin_session_v1';

export interface AdminSession {
  user: AdminUser;
  token: string;
  expiresAt: string;
}

export { sha256 };

/**
 * Login admin using email and either Password OR Secret PIN Code.
 * Enforces anti-brute force firewall lockout, cryptographic vault, and anti-tamper verification.
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

  // Find admin by email or id
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

  // Anti-Tamper Integrity Guard
  const integrityCheck = await verifyAdminIntegrity(admin);
  if (!integrityCheck.valid) {
    await recordAuditLog({
      adminId: admin.id,
      adminName: admin.name,
      action: 'تنبيه أمني: تلاعب في سجل المسؤول',
      entityType: 'SECURITY_ALERT',
      entityId: admin.id,
      details: `محاولة اختراق أو تلاعب مكتشفة في الحساب: ${integrityCheck.reason}`,
      createdAt: new Date().toISOString()
    }).catch(() => {});

    throw new Error('جدار الحماية: تم اكتشاف محاولة تلاعب في بيانات هذا الحساب وتم قفله فورياً لدواعي الأمان.');
  }

  if (admin.status === 'suspended') {
    throw new Error('تم تعطيل هذا الحساب. يرجى مراجعة إدارة النظام.');
  }

  // Verify secret: check PIN / passcode or Password Hash strictly against registered user
  let isValid = false;

  // 1. PIN / Passcode verification (cryptographic vault with salt & SHA-256)
  if (authType === 'pin' || authType === 'any') {
    isValid = await verifyPinSecret(trimmedSecret, admin);
  }

  // 2. Hash verification
  if (!isValid && (authType === 'password' || authType === 'any') && admin.passwordHash) {
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
    throw new Error(`الرقم أو الرمز السري أو كلمة المرور غير صحيحة. متبقي ${failRecord.attemptsRemaining} محاولات.`);
  }

  // Reset failed login counter on success
  securityFirewall.resetFailedAdminLogins();

  // Seamlessly secure the admin account with salted SHA-256 hash & signature if not already secured
  if (!admin.pinHash || !admin.integritySignature) {
    try {
      const secured = await secureAdminRecord(admin, trimmedSecret);
      await updateAdminUser(admin.id, {
        pinHash: secured.pinHash,
        pinSalt: secured.pinSalt,
        integritySignature: secured.integritySignature,
        isTampered: false
      });
      admin.pinHash = secured.pinHash;
      admin.pinSalt = secured.pinSalt;
      admin.integritySignature = secured.integritySignature;
    } catch {}
  }

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
    details: `تم تسجيل الدخول بنجاح بواسطة ${authType === 'pin' ? 'الرمز السري (خزنة مشفرة)' : 'بيانات الاعتماد الرسمية'}.`,
    createdAt: now
  });

  return admin;
}

/**
 * Direct PIN / Alphanumeric Code Login
 * Supports numbers, letters, and combinations with firewall protection and cryptographic vault.
 */
export async function loginWithPinOnly(pinCode: string): Promise<AdminUser> {
  // Check Firewall Lockout
  const lockStatus = securityFirewall.checkAdminLoginStatus();
  if (!lockStatus.allowed) {
    throw new Error(lockStatus.message || 'تم حظر محاولات الدخول مؤقتاً لحماية النظام.');
  }

  const trimmedPin = pinCode.trim();

  if (!trimmedPin) {
    throw new Error('يرجى إدخال الرقم أو الرمز السري للتحقق.');
  }

  const admins = await getAdminUsers();

  // Find matching active admin using cryptographic verification
  let admin: AdminUser | null = null;
  for (const a of admins) {
    if (a.status !== 'active') continue;
    const matches = await verifyPinSecret(trimmedPin, a);
    if (matches) {
      admin = a;
      break;
    }
  }

  if (!admin) {
    const failRecord = securityFirewall.recordFailedAdminLogin();
    await recordAuditLog({
      adminId: 'UNKNOWN',
      adminName: 'مجهول (محاولة إدخال رمز سري)',
      action: 'فشل إدخال الرمز السري',
      entityType: 'SECURITY_ALERT',
      entityId: trimmedPin.length > 2 ? `${trimmedPin.substring(0, 2)}***` : '***',
      details: 'محاولة غير مصرح بها للدخول برمز سري غير معتمد',
      createdAt: new Date().toISOString()
    }).catch(() => {});

    if (failRecord.isLocked) {
      throw new Error('جدار الحماية: تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم قفل النظام لمدة 5 دقائق.');
    }
    throw new Error(`الرقم أو الرمز السري المدخل غير صحيح. متبقي لديك ${failRecord.attemptsRemaining} محاولات قبل القفل المؤقت.`);
  }

  // Anti-Tampering Check: Verify cryptographic signature of the admin record
  const integrityCheck = await verifyAdminIntegrity(admin);
  if (!integrityCheck.valid) {
    await recordAuditLog({
      adminId: admin.id,
      adminName: admin.name,
      action: 'تنبيه أمني: تلاعب في سجل المسؤول',
      entityType: 'SECURITY_ALERT',
      entityId: admin.id,
      details: `محاولة دخول لحساب تم التلاعب في بصمته المشفرة: ${integrityCheck.reason}`,
      createdAt: new Date().toISOString()
    }).catch(() => {});

    throw new Error('جدار الحماية: تم اكتشاف محاولة تلاعب في بيانات هذا الحساب وتم قفله فورياً لدواعي الأمان.');
  }

  // Reset failed login counter on success
  securityFirewall.resetFailedAdminLogins();

  // Seamlessly secure with salted hash & signature if missing
  if (!admin.pinHash || !admin.integritySignature) {
    try {
      const secured = await secureAdminRecord(admin, trimmedPin);
      await updateAdminUser(admin.id, {
        pinHash: secured.pinHash,
        pinSalt: secured.pinSalt,
        integritySignature: secured.integritySignature,
        isTampered: false
      });
      admin.pinHash = secured.pinHash;
      admin.pinSalt = secured.pinSalt;
      admin.integritySignature = secured.integritySignature;
    } catch {}
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
    action: 'تسجيل دخول بالرمز السري',
    entityType: 'SESSION',
    entityId: admin.id,
    details: `تم التحقق المشفر والدخول المباشر بالرمز السري للمسؤول (${admin.name}).`,
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
