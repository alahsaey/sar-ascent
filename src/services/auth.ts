import { AdminUser, AdminRole, AdminPermissions } from '../types';
import { getAdminUsers, updateAdminUser, recordAuditLog } from './db';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../firebase/config';
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
 * Formats admin name for privacy on shared login terminals:
 * Displays only the first initial and full family name (e.g. "S.Alyassin").
 * Keeps email and job titles strictly hidden.
 */
export function formatAdminDisplayName(name: string): string {
  if (!name) return 'المسؤول';
  const cleanName = name.replace(/[()]/g, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'المسؤول';
  if (parts.length === 1) return parts[0];

  const firstLetter = parts[0].charAt(0).toUpperCase();
  const rawLast = parts[parts.length - 1];
  const lastName = rawLast.charAt(0).toUpperCase() + rawLast.slice(1);
  const isAscii = /^[A-Za-z]/.test(firstLetter);
  return isAscii ? `${firstLetter}.${lastName}` : `${firstLetter}. ${lastName}`;
}

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

  // Find admin by email, id, or exact name
  const admin = admins.find(
    a =>
      a.email.toLowerCase() === normalizedInput ||
      a.id.toLowerCase() === normalizedInput ||
      a.name.toLowerCase() === normalizedInput
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
 * Supports choosing or entering the Admin Identity (Name, Email, or Username) along with their Secret PIN.
 * This prevents cross-account confusion when multiple admins log in from the same machine or device.
 */
export async function loginWithPinOnly(pinCode: string, adminIdentifier?: string): Promise<AdminUser> {
  // Check Firewall Lockout
  const lockStatus = securityFirewall.checkAdminLoginStatus();
  if (!lockStatus.allowed) {
    throw new Error(lockStatus.message || 'تم حظر محاولات الدخول مؤقتاً لحماية النظام.');
  }

  const trimmedPin = pinCode.trim();
  const trimmedId = adminIdentifier?.trim().toLowerCase();

  if (!trimmedPin) {
    throw new Error('يرجى إدخال الرقم أو الرمز السري للتحقق.');
  }

  const admins = await getAdminUsers();

  let admin: AdminUser | null = null;

  // 1. If an explicit identifier is provided (e.g., email, name, or account ID)
  if (trimmedId) {
    const targetAdmin = admins.find(
      a =>
        a.email.toLowerCase() === trimmedId ||
        a.id.toLowerCase() === trimmedId ||
        a.name.toLowerCase() === trimmedId ||
        a.name.toLowerCase().includes(trimmedId)
    );

    if (!targetAdmin) {
      const failRecord = securityFirewall.recordFailedAdminLogin();
      throw new Error(`لم يتم العثور على حساب مشرف مسجل بالهوية: "${adminIdentifier}". متبقي لديك ${failRecord.attemptsRemaining} محاولات.`);
    }

    const matches = await verifyPinSecret(trimmedPin, targetAdmin);
    if (!matches) {
      const failRecord = securityFirewall.recordFailedAdminLogin();
      await recordAuditLog({
        adminId: targetAdmin.id,
        adminName: targetAdmin.name,
        action: 'فشل إدخال الرمز السري لمشرف محدد',
        entityType: 'SECURITY_ALERT',
        entityId: targetAdmin.email,
        details: `محاولة إدخال رمز سري غير صحيح لحساب (${targetAdmin.name})`,
        createdAt: new Date().toISOString()
      }).catch(() => {});

      if (failRecord.isLocked) {
        throw new Error('جدار الحماية: تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم قفل النظام لمدة 5 دقائق.');
      }
      throw new Error(`الرمز السري غير صحيح للحساب (${formatAdminDisplayName(targetAdmin.name)}). متبقي لديك ${failRecord.attemptsRemaining} محاولات.`);
    }

    admin = targetAdmin;
  } else {
    // 2. If no identifier provided, search among all admins whose PIN matches
    for (const a of admins) {
      const matches = await verifyPinSecret(trimmedPin, a);
      if (matches) {
        admin = a;
        break;
      }
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
    throw new Error(`الرقم أو الرمز السري المدخل غير صحيح لأي حساب مشرف. متبقي لديك ${failRecord.attemptsRemaining} محاولات.`);
  }

  // Ensure active status and anti-tamper compliance
  if (admin.id === 'admin-super-01' || admin.email.toLowerCase() === 'alahsaey@gmail.com') {
    admin.status = 'active';
    admin.isTampered = false;
    const secured = await secureAdminRecord(admin, trimmedPin);
    admin.pinHash = secured.pinHash;
    admin.pinSalt = secured.pinSalt;
    admin.integritySignature = secured.integritySignature;
  } else {
    // Check if account was suspended
    if (admin.status === 'suspended') {
      throw new Error(`حساب المشرف (${formatAdminDisplayName(admin.name)}) معطل حالياً. يرجى مراجعة إدارة النظام.`);
    }

    // Verify cryptographic signature of the admin record
    const integrityCheck = await verifyAdminIntegrity(admin);
    if (!integrityCheck.valid) {
      // Auto-heal signature with verified PIN if matches
      admin.status = 'active';
      admin.isTampered = false;
      const secured = await secureAdminRecord(admin, trimmedPin);
      admin.pinHash = secured.pinHash;
      admin.pinSalt = secured.pinSalt;
      admin.integritySignature = secured.integritySignature;
      await updateAdminUser(admin.id, admin).catch(() => {});
    }
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

/**
 * Enterprise Google Sign-In for SAR Travel Permit Admins.
 * Authenticates the admin using their verified Google identity.
 * Strictly verifies whether the Google email belongs to an authorized admin account.
 */
export async function loginAdminWithGoogle(): Promise<AdminUser> {
  // 1. Check Firewall Lockout
  const lockStatus = securityFirewall.checkAdminLoginStatus();
  if (!lockStatus.allowed) {
    throw new Error(lockStatus.message || 'تم حظر محاولات الدخول مؤقتاً لحماية النظام.');
  }

  // 2. Perform Google Authentication
  let result;
  try {
    result = await signInWithPopup(auth, googleAuthProvider);
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      throw new Error('تم إلغاء نافذة تسجيل الدخول عبر Google.');
    }
    if (err.code === 'auth/popup-blocked') {
      throw new Error('قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة من إعدادات المتصفح.');
    }
    if (err.code === 'auth/network-request-failed') {
      throw new Error('فشل الاتصال بالإنترنت أثناء تسجيل الدخول عبر Google.');
    }
    throw new Error(err.message || 'تعذر استكمال تسجيل الدخول عبر حساب Google.');
  }

  const googleUser = result.user;
  const email = googleUser.email?.trim().toLowerCase();

  if (!email) {
    throw new Error('لم يتم العثور على بريد إلكتروني صالح مرتبط بحساب Google المختار.');
  }

  // 3. Load Admins and match strictly
  const admins = await getAdminUsers();
  let admin = admins.find(a => a.email.toLowerCase() === email);

  // If email is the registered project owner (alahsaey@gmail.com), auto-bind to the Root Super Admin
  if (!admin && email === 'alahsaey@gmail.com') {
    admin = admins.find(a => a.id === 'admin-super-01' || a.role === 'super_admin') || admins[0];
  }

  // 4. Strict Security Verification: Reject unauthorized Google accounts
  if (!admin) {
    const failRecord = securityFirewall.recordFailedAdminLogin();
    await recordAuditLog({
      adminId: 'UNKNOWN_GOOGLE',
      adminName: googleUser.displayName || 'مستخدم Google غير مسجل',
      action: 'فشل محاولة دخول بحساب Google غير مصرح به',
      entityType: 'SECURITY_ALERT',
      entityId: email,
      details: `محاولة دخول بحساب Google غير مصرح به أو غير مسجل في النظام: ${email}`,
      createdAt: new Date().toISOString()
    }).catch(() => {});

    if (failRecord.isLocked) {
      throw new Error('جدار الحماية: تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم قفل النظام مؤقتاً.');
    }

    throw new Error(
      `تم التحقق من حساب Google (${email})، ولكن هذا البريد غير مسجل كمسؤول أو مراجع في نظام سار.`
    );
  }

  // 5. Automatic Recovery & Activation for Root Super Admin / Owner:
  // If the owner logged in via Google, always ensure active status and unfreeze
  if (admin.id === 'admin-super-01' || email === 'alahsaey@gmail.com' || admin.role === 'super_admin') {
    admin.status = 'active';
    admin.isTampered = false;
    admin.email = email;
    admin.name = admin.name === 'مدير النظام (سار)' ? 'saleh h. alyassin' : admin.name;
    const secured = await secureAdminRecord(admin, admin.pinCode || '202600');
    admin = await updateAdminUser(admin.id, secured).catch(() => secured);
  }

  // Check if suspended (for non-owner accounts)
  if (admin.status === 'suspended') {
    throw new Error('تم تعطيل هذا الحساب. يرجى مراجعة إدارة النظام.');
  }

  // Reset firewall counters
  securityFirewall.resetFailedAdminLogins();

  // Update last login
  const now = new Date().toISOString();
  try {
    await updateAdminUser(admin.id, { lastLoginAt: now });
    admin.lastLoginAt = now;
  } catch {
    // Continue
  }

  // Issue Admin Session
  const session: AdminSession = {
    user: admin,
    token: 'google_session_' + Date.now() + '_' + Math.random().toString(36).substring(2),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  await recordAuditLog({
    adminId: admin.id,
    adminName: admin.name,
    action: 'تسجيل دخول موثق عبر Google',
    entityType: 'SESSION',
    entityId: admin.id,
    details: `تم التحقق والمصادقة الأمنية بنجاح عبر حساب Google الرسمي (${email}) للمسؤول (${admin.name}).`,
    createdAt: now
  }).catch(() => {});

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
