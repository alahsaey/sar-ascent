import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { securityFirewall } from './security';
import { getTodayISODate, isMatchingFilterDate } from '../utils/date';
import {
  EmployeeList,
  VerificationLog,
  VerificationResult,
  AuditLog,
  AdminUser,
  AdminRole,
  AdminPermissions,
  ListStatus,
  ParsedEmployeeItem
} from '../types';

const LISTS_COLLECTION = 'employee_lists';
const LISTS_DATA_COLLECTION = 'employee_lists_data';
const EMPLOYEES_COLLECTION = 'employees';
const LOGS_COLLECTION = 'verification_logs';
const AUDIT_COLLECTION = 'audit_logs';
const ADMINS_COLLECTION = 'admins';

// Local storage backup keys for high-speed resiliency and 0ms latency
const LOCAL_KEY_LISTS = 'permit_sys_lists_v2';
const LOCAL_KEY_EMPLOYEES = 'permit_sys_employees_v2';
const LOCAL_KEY_LOGS = 'permit_sys_logs_v2';
const LOCAL_KEY_AUDIT = 'permit_sys_audit_v2';
const LOCAL_KEY_ADMINS = 'permit_sys_admins_v2';

export function getDefaultPermissions(role: AdminRole): AdminPermissions {
  if (role === 'super_admin') {
    return {
      canUploadLists: true,
      canApproveLists: true,
      canDeleteLists: true,
      canManageAdmins: true,
      canViewAuditLogs: true,
      canExportLogs: true,
    };
  } else if (role === 'admin') {
    return {
      canUploadLists: true,
      canApproveLists: true,
      canDeleteLists: false,
      canManageAdmins: false,
      canViewAuditLogs: false,
      canExportLogs: true,
    };
  } else {
    return {
      canUploadLists: false,
      canApproveLists: false,
      canDeleteLists: false,
      canManageAdmins: false,
      canViewAuditLogs: false,
      canExportLogs: true,
    };
  }
}

export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'admin-super-01',
    name: 'مدير النظام (سار)',
    email: 'admin@sar.com.sa',
    // Hash simulation for "Admin@2026"
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    pinCode: '202600',
    role: 'super_admin',
    permissions: getDefaultPermissions('super_admin'),
    status: 'active',
    createdAt: '2026-01-01T08:00:00',
    updatedAt: '2026-01-01T08:00:00'
  },
  {
    id: 'admin-ops-02',
    name: 'مسؤول المراجعة والتدقيق',
    email: 'reviewer@sar.com.sa',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    pinCode: '202601',
    role: 'admin',
    permissions: getDefaultPermissions('admin'),
    status: 'active',
    createdAt: '2026-02-15T09:30:00',
    updatedAt: '2026-02-15T09:30:00'
  }
];

// Helper to access LocalStorage safely
function getLocal<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
}

// Timeout helper to avoid blocking UI or throwing unhandled errors if Firestore is connecting/offline
async function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

// Global broadcast channel for instant multi-tab & multi-component sync
let syncBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncBroadcastChannel = new BroadcastChannel('sar_storage_sync');
    syncBroadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'SAR_STORAGE_MUTATION') {
        flushMemoryCaches();
        window.dispatchEvent(new CustomEvent('sar-storage-changed', { detail: event.data }));
      }
    };
  }
} catch {
  // Graceful fallback
}

/**
 * Broadcast storage mutations instantaneously to all tabs and views
 */
export function broadcastStorageChange(action: string, payload?: any): void {
  flushMemoryCaches();
  if (typeof window !== 'undefined') {
    const eventDetail = { action, payload, timestamp: Date.now() };
    window.dispatchEvent(new CustomEvent('sar-storage-changed', { detail: eventDetail }));
    try {
      syncBroadcastChannel?.postMessage({ type: 'SAR_STORAGE_MUTATION', ...eventDetail });
    } catch {}
  }
}

// In-memory cache for ultra-fast instant lookups (O(1))
let activeEmployeesCache: Set<string> | null = null;
let activeEmployeesDetailsMap: Map<string, {
  name?: string;
  allowedRoute?: string;
  department?: string;
  listId?: string;
  listTitle?: string;
  listVersion?: number;
}> | null = null;
let activeListCache: EmployeeList | null = null;

export function flushMemoryCaches(): void {
  activeEmployeesCache = null;
  activeEmployeesDetailsMap = null;
  activeListCache = null;
}

/**
 * Initialize database.
 * STRICT POLICY: NEVER generates or seeds mock or external lists.
 * Only authenticates admins and ensures real uploaded data persists.
 */
export async function initializeDatabase(): Promise<void> {
  // Purge legacy v1 demo data if present
  try {
    localStorage.removeItem('permit_sys_lists_v1');
    localStorage.removeItem('permit_sys_employees_v1');
  } catch {}

  // Sync admins from Firestore
  try {
    const snap = await withTimeout(getDocs(collection(db, ADMINS_COLLECTION)), 2500);
    if (!snap.empty) {
      const remoteAdmins: AdminUser[] = [];
      snap.forEach(d => remoteAdmins.push(d.data() as AdminUser));
      if (remoteAdmins.length > 0) {
        setLocal(LOCAL_KEY_ADMINS, remoteAdmins);
      }
    } else {
      // If Firestore is completely empty for admins, seed default admins
      setLocal(LOCAL_KEY_ADMINS, INITIAL_ADMINS);
      for (const adm of INITIAL_ADMINS) {
        await withTimeout(setDoc(doc(db, ADMINS_COLLECTION, adm.id), adm), 1500).catch(() => {});
      }
    }
  } catch {
    const localAdmins = getLocal<AdminUser[]>(LOCAL_KEY_ADMINS, []);
    if (localAdmins.length === 0) {
      setLocal(LOCAL_KEY_ADMINS, INITIAL_ADMINS);
    }
  }
}

/**
 * Retrieves all currently active and approved employee lists uploaded by admins.
 */
export async function getActiveEmployeeLists(): Promise<EmployeeList[]> {
  const lists = await getAllEmployeeLists();
  return lists.filter(l => l.status === 'active');
}

/**
 * Retrieves the primary/latest active employee list.
 */
export async function getActiveEmployeeList(): Promise<EmployeeList | null> {
  const activeLists = await getActiveEmployeeLists();
  return activeLists[0] || null;
}

/**
 * Get all employee records associated with a specific uploaded list.
 * Safely fetches chunked data from Firestore if not in local cache.
 */
export async function getListEmployees(listId: string): Promise<ParsedEmployeeItem[]> {
  const empMap = getLocal<Record<string, any[]>>(LOCAL_KEY_EMPLOYEES, {});
  let localList = empMap[listId] || [];

  // If local store is empty on this device, fetch from dedicated Firestore bundle / chunks
  if (localList.length === 0) {
    try {
      // 1. Try reading manifest / single bundle doc
      const dataSnap = await getDoc(doc(db, LISTS_DATA_COLLECTION, listId));
      if (dataSnap.exists()) {
        const data = dataSnap.data();
        if (data?.employees && Array.isArray(data.employees) && data.employees.length > 0) {
          localList = data.employees;
        } else if (data?.totalChunks && data.totalChunks > 0) {
          // Multi-chunk download in parallel
          const chunkPromises: Promise<any>[] = [];
          for (let i = 0; i < data.totalChunks; i++) {
            chunkPromises.push(getDoc(doc(db, LISTS_DATA_COLLECTION, `${listId}_part_${i}`)));
          }
          const chunkSnaps = await Promise.all(chunkPromises);
          const merged: any[] = [];
          for (const cSnap of chunkSnaps) {
            if (cSnap.exists() && Array.isArray(cSnap.data()?.employees)) {
              merged.push(...cSnap.data().employees);
            }
          }
          localList = merged;
        }
      }

      // 2. Query chunk documents if manifest didn't contain direct items
      if (localList.length === 0) {
        const q = query(collection(db, LISTS_DATA_COLLECTION), where('listId', '==', listId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const chunkDocs = snap.docs.map(d => d.data());
          chunkDocs.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
          const merged: any[] = [];
          for (const c of chunkDocs) {
            if (Array.isArray(c.employees)) {
              merged.push(...c.employees);
            }
          }
          localList = merged;
        }
      }

      // 3. Fallback to EMPLOYEES_COLLECTION if older schema
      if (localList.length === 0) {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where('listId', '==', listId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          snap.forEach(d => {
            const data = d.data();
            if (data.employeeNumber) {
              localList.push({
                number: String(data.employeeNumber),
                name: data.employeeName || undefined,
                allowedRoute: data.allowedRoute || undefined,
                department: data.department || undefined
              });
            }
          });
        }
      }

      if (localList.length > 0) {
        empMap[listId] = localList;
        setLocal(LOCAL_KEY_EMPLOYEES, empMap);
      }
    } catch (err) {
      console.error('Error fetching list employee data from Firestore:', err);
    }
  }

  const results: ParsedEmployeeItem[] = [];

  localList.forEach(item => {
    if (typeof item === 'string') {
      results.push({
        number: item.trim()
      });
    } else if (item && item.number) {
      results.push({
        number: String(item.number).trim(),
        name: item.name ? String(item.name).trim() : undefined,
        allowedRoute: item.allowedRoute ? String(item.allowedRoute).trim() : undefined,
        department: item.department ? String(item.department).trim() : undefined
      });
    }
  });

  return results;
}

/**
 * Preloads all active employee numbers and details from ALL active approved lists into memory for instantaneous O(1) lookup.
 * Strictly uses data from uploaded lists across all connected devices.
 */
export async function loadActiveEmployeesSet(targetListId?: string): Promise<Set<string>> {
  const activeLists = await getActiveEmployeeLists();
  
  if (targetListId && activeEmployeesCache && activeListCache?.id === targetListId && activeEmployeesDetailsMap) {
    return activeEmployeesCache;
  }

  const set = new Set<string>();
  const detailsMap = new Map<string, {
    name?: string;
    allowedRoute?: string;
    department?: string;
    listId?: string;
    listTitle?: string;
    listVersion?: number;
  }>();

  const listsToScan = targetListId 
    ? activeLists.filter(l => l.id === targetListId)
    : activeLists;

  for (const aList of listsToScan) {
    const listEmployees = await getListEmployees(aList.id);
    listEmployees.forEach(emp => {
      const num = String(emp.number).trim();
      if (num) {
        set.add(num);
        detailsMap.set(num, {
          name: emp.name ? String(emp.name).trim() : undefined,
          allowedRoute: emp.allowedRoute ? String(emp.allowedRoute).trim() : undefined,
          department: emp.department ? String(emp.department).trim() : undefined,
          listId: aList.id,
          listTitle: aList.title,
          listVersion: aList.versionNumber
        });
      }
    });
  }

  activeEmployeesCache = set;
  activeEmployeesDetailsMap = detailsMap;
  return set;
}

/**
 * Public Verification function:
 * Strictly verifies the employee number against ALL active lists.
 * Protected by Security Firewall (Rate limiting + Sanitization + Threat Shield).
 */
export async function verifyEmployeeTravel(employeeNumberRaw: string): Promise<VerificationResult> {
  // 1. Security Firewall Rate Limit Check
  const rateLimitStatus = securityFirewall.checkVerificationRateLimit();
  if (!rateLimitStatus.allowed) {
    throw new Error(rateLimitStatus.message || 'RATE_LIMITED');
  }

  // 2. Input Sanitization & Threat Detection
  const { cleanInput, isValid, securityFlag } = securityFirewall.sanitizeEmployeeInput(employeeNumberRaw);
  if (!isValid || !cleanInput) {
    if (securityFlag === 'ATTACK_PAYLOAD_DETECTED') {
      await recordAuditLog({
        adminId: 'FIREWALL_WAF',
        adminName: 'جدار الحماية الأمني',
        action: 'اعتراض محاولة حقن / تطفل',
        entityType: 'SECURITY_THREAT',
        entityId: employeeNumberRaw.substring(0, 30),
        details: `تم حجب مدخلات غير آمنة ومشبوهة: ${employeeNumberRaw.substring(0, 30)}`,
        createdAt: new Date().toISOString()
      }).catch(() => {});
      throw new Error('تم رصد مدخلات غير آمنة ومرفوضة من قبل جدار الحماية.');
    }
    throw new Error('EMPTY_INPUT');
  }

  const employeeNumber = cleanInput;

  const activeLists = await getActiveEmployeeLists();
  if (activeLists.length === 0) {
    throw new Error('NO_ACTIVE_LIST');
  }

  const authorizedSet = await loadActiveEmployeesSet();
  const isAuthorized = authorizedSet.has(employeeNumber);
  const details = isAuthorized ? activeEmployeesDetailsMap?.get(employeeNumber) : undefined;

  const employeeName = details?.name;
  const allowedRoute = details?.allowedRoute;

  // Find the matched list or fallback to the first active list
  const matchedList = (details?.listId ? activeLists.find(l => l.id === details.listId) : null) || activeLists[0];
  const lastUpdated = matchedList.approvedAt || matchedList.uploadedAt;
  const inquiryTime = new Date().toISOString();

  const result: VerificationResult = {
    authorized: isAuthorized,
    message: isAuthorized ? 'مصرح له الصعود بأمر إركاب' : 'ليس لديه أمر إركاب موظف',
    lastUpdated: lastUpdated,
    listTitle: matchedList.title,
    listVersion: matchedList.versionNumber,
    employeeNumber: employeeNumber,
    employeeName: employeeName,
    allowedRoute: allowedRoute,
    checkedAt: inquiryTime,
  };

  // Record in centralized Firestore verification logs reliably
  try {
    await recordVerificationLog({
      employeeNumber,
      employeeName,
      allowedRoute,
      result: isAuthorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
      listId: matchedList.id,
      listTitle: matchedList.title,
      checkedAt: inquiryTime,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    });
  } catch (err) {
    console.error('Verification log recording error:', err);
  }

  return result;
}

/**
 * Records a verification log entry to both local cache and Firestore cloud database.
 */
export async function recordVerificationLog(log: Omit<VerificationLog, 'id'>): Promise<void> {
  const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const fullLog: VerificationLog = { ...log, id };

  // 1. Local storage for immediate availability
  try {
    const logs = getLocal<VerificationLog[]>(LOCAL_KEY_LOGS, []);
    const updated = [fullLog, ...logs.filter(l => l.id !== id)].slice(0, 2000);
    setLocal(LOCAL_KEY_LOGS, updated);
  } catch (err) {
    console.error('Local log write error:', err);
  }

  // 2. Direct write to central Firestore collection
  try {
    await setDoc(doc(db, LOGS_COLLECTION, id), fullLog);
  } catch (err) {
    console.error('Firestore log write error:', err);
  }

  // 3. Instant local notification
  broadcastStorageChange('new_verification_log', fullLog);
}

/**
 * Get all employee lists.
 * Synchronizes with Firestore cloud database as authoritative source of truth.
 */
export async function getAllEmployeeLists(): Promise<EmployeeList[]> {
  try {
    const q = query(collection(db, LISTS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const remoteLists = snap.docs.map(d => d.data() as EmployeeList);
    const sorted = remoteLists.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setLocal(LOCAL_KEY_LISTS, sorted);
    return sorted;
  } catch (err) {
    console.warn('Firestore getAllEmployeeLists offline fallback:', err);
    return getLocal<EmployeeList[]>(LOCAL_KEY_LISTS, []);
  }
}

/**
 * Creates a new employee list and uploads the employee numbers and names to Firestore.
 * Automatically chunks large employee datasets to stay safely within Firestore document limits.
 */
export async function createEmployeeList(
  meta: Omit<EmployeeList, 'id' | 'createdAt' | 'versionNumber'>,
  employeesInput: (string | ParsedEmployeeItem)[]
): Promise<EmployeeList> {
  const existingLists = await getAllEmployeeLists();
  const nextVersion = existingLists.reduce((max, l) => Math.max(max, l.versionNumber || 0), 0) + 1;

  const listId = 'list-' + Date.now();
  const parsedEmployees: ParsedEmployeeItem[] = employeesInput.map(item => {
    if (typeof item === 'string') {
      return { number: item.trim() };
    }
    return {
      ...item,
      number: String(item.number).trim()
    };
  });

  const employeeNumbers = parsedEmployees.map(e => e.number);

  const newList: EmployeeList = {
    ...meta,
    id: listId,
    versionNumber: nextVersion,
    createdAt: new Date().toISOString(),
    totalRecords: employeeNumbers.length,
    status: meta.status || 'uploaded',
  };

  // Store in LocalStorage synchronously
  const updatedLists = [newList, ...existingLists.filter(l => l.id !== listId)];
  setLocal(LOCAL_KEY_LISTS, updatedLists);

  const empMap = getLocal<Record<string, any>>(LOCAL_KEY_EMPLOYEES, {});
  empMap[listId] = parsedEmployees;
  setLocal(LOCAL_KEY_EMPLOYEES, empMap);

  // Invalidate memory caches and broadcast
  flushMemoryCaches();
  broadcastStorageChange('create_list', { listId, newList });

  // Sync to Firestore cloud database with chunking
  try {
    // 1. Save list metadata
    await setDoc(doc(db, LISTS_COLLECTION, listId), newList);

    // 2. Chunk employees in batches of 800 items (~60KB per document, well below 1MB limit)
    const CHUNK_SIZE = 800;
    const totalChunks = Math.ceil(parsedEmployees.length / CHUNK_SIZE) || 1;
    const writePromises: Promise<any>[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunk = parsedEmployees.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkDocId = `${listId}_part_${i}`;
      writePromises.push(
        setDoc(doc(db, LISTS_DATA_COLLECTION, chunkDocId), {
          listId,
          chunkIndex: i,
          totalChunks,
          totalRecords: parsedEmployees.length,
          employees: chunk,
          createdAt: newList.createdAt
        })
      );
    }

    // 3. Save manifest document
    writePromises.push(
      setDoc(doc(db, LISTS_DATA_COLLECTION, listId), {
        listId,
        totalChunks,
        totalRecords: parsedEmployees.length,
        createdAt: newList.createdAt
      })
    );

    await Promise.all(writePromises);
  } catch (err) {
    console.error('Firestore list creation sync error:', err);
  }

  return newList;
}

/**
 * Approves and activates a list:
 * If archiveOtherLists is true, archives previously active lists immediately.
 * If archiveOtherLists is false, activates this list alongside other active lists.
 */
export async function approveEmployeeList(
  listId: string,
  approvedBy: string,
  archiveOtherLists: boolean = false
): Promise<void> {
  const lists = await getAllEmployeeLists();
  const listToApprove = lists.find(l => l.id === listId);
  if (!listToApprove) {
    throw new Error('القائمة المحددة غير موجودة.');
  }

  const now = new Date().toISOString();

  // Update lists statuses in storage
  const updatedLists = lists.map(l => {
    if (l.id === listId) {
      return {
        ...l,
        status: 'active' as ListStatus,
        approvedBy,
        approvedAt: now
      };
    }
    if (archiveOtherLists && l.status === 'active') {
      return {
        ...l,
        status: 'archived' as ListStatus
      };
    }
    return l;
  });

  setLocal(LOCAL_KEY_LISTS, updatedLists);
  flushMemoryCaches();

  // Instant notification
  broadcastStorageChange('approve_list', { listId, archiveOtherLists });

  // Sync to Firestore
  try {
    const batch = writeBatch(db);
    for (const l of updatedLists) {
      if (l.id === listId) {
        batch.update(doc(db, LISTS_COLLECTION, l.id), {
          status: 'active',
          approvedBy,
          approvedAt: now
        });
      } else if (archiveOtherLists && l.status === 'archived') {
        batch.update(doc(db, LISTS_COLLECTION, l.id), {
          status: 'archived'
        });
      }
    }
    await batch.commit();
  } catch (err) {
    console.error('Firestore list approval update error:', err);
  }

  // Record Audit Log
  await recordAuditLog({
    adminId: 'current-admin',
    adminName: approvedBy,
    action: `اعتماد وتفعيل القائمة #${listToApprove.versionNumber}`,
    entityType: 'employee_lists',
    entityId: listId,
    details: `تم اعتماد وتفعيل القائمة (${listToApprove.title}) بعدد ${listToApprove.totalRecords} موظفاً بنجاح`,
    createdAt: now
  }).catch(() => {});
}

/**
 * Archives a list manually
 */
export async function archiveEmployeeList(listId: string, adminName: string): Promise<void> {
  const lists = await getAllEmployeeLists();
  const target = lists.find(l => l.id === listId);
  if (!target) return;

  const updatedLists = lists.map(l => l.id === listId ? { ...l, status: 'archived' as ListStatus } : l);
  setLocal(LOCAL_KEY_LISTS, updatedLists);
  flushMemoryCaches();

  broadcastStorageChange('archive_list', { listId });

  try {
    await updateDoc(doc(db, LISTS_COLLECTION, listId), { status: 'archived' });
  } catch (err) {
    console.error('Firestore list archive error:', err);
  }

  await recordAuditLog({
    adminId: 'current-admin',
    adminName,
    action: `أرشفة القائمة #${target.versionNumber}`,
    entityType: 'employee_lists',
    entityId: listId,
    details: `تم أرشفة القائمة (${target.title}) يدوياً`,
    createdAt: new Date().toISOString()
  }).catch(() => {});
}

/**
 * Deletes an employee list and its associated employee records permanently and instantly.
 * Completely cleans memory, local storage, and database so no old records linger.
 */
export async function deleteEmployeeList(listId: string, adminName: string): Promise<void> {
  const lists = getLocal<EmployeeList[]>(LOCAL_KEY_LISTS, []);
  const target = lists.find(l => l.id === listId);

  // 1. Instant Synchronous Clean-up in LocalStorage
  const remainingLists = lists.filter(l => l.id !== listId);
  setLocal(LOCAL_KEY_LISTS, remainingLists);

  const empMap = getLocal<Record<string, any>>(LOCAL_KEY_EMPLOYEES, {});
  delete empMap[listId];
  setLocal(LOCAL_KEY_EMPLOYEES, empMap);

  // 2. Instant Memory Invalidation & Global Broadcast
  flushMemoryCaches();
  broadcastStorageChange('delete_list', { listId });

  // 3. Permanent Deletion in Firestore
  try {
    await deleteDoc(doc(db, LISTS_COLLECTION, listId));
    await deleteDoc(doc(db, LISTS_DATA_COLLECTION, listId)).catch(() => {});

    // Delete chunks
    const chunkQuery = query(collection(db, LISTS_DATA_COLLECTION), where('listId', '==', listId));
    const chunkSnap = await getDocs(chunkQuery);
    if (!chunkSnap.empty) {
      const batch = writeBatch(db);
      chunkSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit().catch(() => {});
    }

    // Query and delete employees from legacy collection if any
    const q = query(collection(db, EMPLOYEES_COLLECTION), where('listId', '==', listId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit().catch(() => {});
    }
  } catch (err) {
    console.error('Firestore list deletion error:', err);
  }

  // 4. Record Audit Log
  if (target) {
    await recordAuditLog({
      adminId: 'current-admin',
      adminName,
      action: `حذف القائمة #${target.versionNumber}`,
      entityType: 'employee_lists',
      entityId: listId,
      details: `تم حذف القائمة (${target.title}) وملفها (${target.fileName}) وتطهير كافة سجلات موظفيها نهائياً من النظام`,
      createdAt: new Date().toISOString()
    }).catch(() => {});
  }
}

/**
 * Completely clears ALL lists and employee data from the system with immediate purge.
 */
export async function clearAllEmployeeLists(adminName: string): Promise<void> {
  const lists = getLocal<EmployeeList[]>(LOCAL_KEY_LISTS, []);
  
  // 1. Clear LocalStorage immediately
  setLocal(LOCAL_KEY_LISTS, []);
  setLocal(LOCAL_KEY_EMPLOYEES, {});

  // 2. Invalidate cache and broadcast
  flushMemoryCaches();
  broadcastStorageChange('clear_all_lists');

  // 3. Clear Firestore lists & data
  try {
    const listSnap = await getDocs(collection(db, LISTS_COLLECTION));
    if (!listSnap.empty) {
      const batch = writeBatch(db);
      listSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit().catch(() => {});
    }

    const dataSnap = await getDocs(collection(db, LISTS_DATA_COLLECTION));
    if (!dataSnap.empty) {
      const batch = writeBatch(db);
      dataSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit().catch(() => {});
    }
  } catch (err) {
    console.error('Firestore clear all lists error:', err);
  }

  // 4. Audit Log
  await recordAuditLog({
    adminId: 'current-admin',
    adminName,
    action: 'تطهير وحذف كافة القوائم',
    entityType: 'SYSTEM_PURGE',
    entityId: 'ALL_LISTS',
    details: `تم تطهير وحذف كافة القوائم (${lists.length} قائمة) وسجلات موظفيها نهائياً من النظام`,
    createdAt: new Date().toISOString()
  }).catch(() => {});
}

/**
 * Migrates all verification logs from localStorage into the centralized Firestore collection.
 * Only uploads unmigrated logs when explicitly invoked.
 */
export async function migrateLocalLogsToFirestore(): Promise<{
  totalLocal: number;
  migratedCount: number;
  alreadySyncedCount: number;
  success: boolean;
  message?: string;
}> {
  const localLogs = getLocal<VerificationLog[]>(LOCAL_KEY_LOGS, []);
  if (localLogs.length === 0) {
    return {
      totalLocal: 0,
      migratedCount: 0,
      alreadySyncedCount: 0,
      success: true,
      message: 'لا توجد سجلات محلية في هذا المتصفح تحتاج إلى ترحيل.'
    };
  }

  try {
    // 1. Fetch existing remote logs IDs to prevent duplicate writes
    const snap = await getDocs(collection(db, LOGS_COLLECTION));
    const remoteIdSet = new Set<string>();
    snap.forEach(d => remoteIdSet.add(d.id));

    const logsToMigrate = localLogs.filter(l => l && l.id && !remoteIdSet.has(l.id));

    if (logsToMigrate.length > 0) {
      const batchSize = 400;
      for (let i = 0; i < logsToMigrate.length; i += batchSize) {
        const chunk = logsToMigrate.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(log => {
          const logRef = doc(db, LOGS_COLLECTION, log.id);
          batch.set(logRef, log);
        });
        await batch.commit();
      }
    }

    const remoteLogs: VerificationLog[] = snap.docs.map(d => d.data() as VerificationLog);
    const merged = remoteLogs.sort(
      (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
    setLocal(LOCAL_KEY_LOGS, merged.slice(0, 2000));
    broadcastStorageChange('migrate_logs', { count: logsToMigrate.length });

    return {
      totalLocal: localLogs.length,
      migratedCount: logsToMigrate.length,
      alreadySyncedCount: localLogs.length - logsToMigrate.length,
      success: true,
      message: logsToMigrate.length > 0
        ? `تم بنجاح ترحيل ومزامنة ${logsToMigrate.length} سجل إلى قاعدة البيانات السحابية المركزية.`
        : 'كافة السجلات المحلية متزامنة بالفعل ومحدثة مع السحابة المركزية.'
    };
  } catch (err) {
    console.error('Error during logs migration to Firestore:', err);
    return {
      totalLocal: localLogs.length,
      migratedCount: 0,
      alreadySyncedCount: 0,
      success: false,
      message: 'تعذر الاتصال بالسحابة لترحيل السجلات. يرجى التحقق من الاتصال بالإنترنت.'
    };
  }
}

/**
 * Clear all verification logs across local and Firestore database
 */
export async function clearVerificationLogs(adminName: string): Promise<void> {
  // 1. Clear local storage
  setLocal(LOCAL_KEY_LOGS, []);

  // 2. Clear Firestore verification logs
  try {
    const snap = await getDocs(collection(db, LOGS_COLLECTION));
    if (!snap.empty) {
      const batchSize = 400;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const chunk = docs.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err) {
    console.error('Error clearing Firestore logs:', err);
  }

  broadcastStorageChange('clear_verification_logs');

  await recordAuditLog({
    adminId: 'current-admin',
    adminName,
    action: 'تطهير سجلات التحقق',
    entityType: 'LOGS_PURGE',
    entityId: 'ALL_VERIFICATION_LOGS',
    details: `تم تفريغ وحذف كافة سجلات التحقق من النظام وقاعدة البيانات السحابية`,
    createdAt: new Date().toISOString()
  });
}

/**
 * Get Verification Logs with filtering and pagination
 * Relies on Firestore as authoritative source of truth, gracefully caching locally.
 */
export async function getVerificationLogs(options?: {
  employeeNumber?: string;
  result?: 'ALL' | 'AUTHORIZED' | 'NOT_AUTHORIZED';
  startDate?: string;
  endDate?: string;
  dateFilter?: string;
  limitCount?: number;
}): Promise<VerificationLog[]> {
  let allLogs: VerificationLog[] = [];

  try {
    const q = query(
      collection(db, LOGS_COLLECTION),
      orderBy('checkedAt', 'desc'),
      limit(options?.limitCount || 500)
    );
    const snap = await getDocs(q);
    const remoteLogs = snap.docs.map(d => d.data() as VerificationLog);
    allLogs = remoteLogs.sort(
      (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
    setLocal(LOCAL_KEY_LOGS, allLogs.slice(0, 2000));
  } catch (err) {
    console.warn('Firestore getVerificationLogs offline fallback:', err);
    allLogs = getLocal<VerificationLog[]>(LOCAL_KEY_LOGS, []);
  }

  let filtered = allLogs;

  if (options?.employeeNumber) {
    const qNum = options.employeeNumber.trim();
    filtered = filtered.filter(l => 
      (l.employeeNumber && l.employeeNumber.includes(qNum)) ||
      (l.employeeName && l.employeeName.includes(qNum))
    );
  }

  if (options?.result && options.result !== 'ALL') {
    filtered = filtered.filter(l => l.result === options.result);
  }

  if (options?.dateFilter) {
    filtered = filtered.filter(l => isMatchingFilterDate(l.checkedAt, options.dateFilter!));
  }

  if (options?.startDate) {
    const start = new Date(options.startDate).getTime();
    filtered = filtered.filter(l => new Date(l.checkedAt).getTime() >= start);
  }

  if (options?.endDate) {
    const end = new Date(options.endDate).getTime();
    filtered = filtered.filter(l => new Date(l.checkedAt).getTime() <= end);
  }

  if (options?.limitCount) {
    filtered = filtered.slice(0, options.limitCount);
  }

  return filtered;
}

/**
 * Real-time subscription to Verification Logs via Firestore onSnapshot.
 * Updates listener immediately whenever any mobile/desktop device logs a verification.
 */
export function subscribeToVerificationLogs(
  onUpdate: (logs: VerificationLog[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const q = query(
      collection(db, LOGS_COLLECTION),
      orderBy('checkedAt', 'desc'),
      limit(500)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const remoteLogs = snapshot.docs.map(d => d.data() as VerificationLog);
        const sorted = remoteLogs.sort(
          (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
        );
        setLocal(LOCAL_KEY_LOGS, sorted.slice(0, 2000));
        onUpdate(sorted);
      },
      (err) => {
        console.warn('Real-time logs subscription note:', err);
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize logs subscription:', err);
    return () => {};
  }
}

/**
 * Real-time subscription to Employee Lists via Firestore onSnapshot.
 */
export function subscribeToEmployeeLists(
  onUpdate: (lists: EmployeeList[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const q = query(collection(db, LISTS_COLLECTION), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const remoteLists = snapshot.docs.map(d => d.data() as EmployeeList);
        const sorted = remoteLists.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setLocal(LOCAL_KEY_LISTS, sorted);
        flushMemoryCaches();
        onUpdate(sorted);
      },
      (err) => {
        console.warn('Real-time lists subscription note:', err);
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize lists subscription:', err);
    return () => {};
  }
}

/**
 * Get System Dashboard Statistics
 */
export async function getDashboardStats() {
  const lists = await getAllEmployeeLists();
  const activeLists = lists.filter(l => l.status === 'active');
  const activeList = activeLists[0] || null;
  const latestList = lists[0] || null;
  const logs = await getVerificationLogs();

  const totalActiveEmployees = activeLists.reduce((sum, l) => sum + (l.totalRecords || 0), 0);
  const authorizedCount = logs.filter(l => l.result === 'AUTHORIZED').length;
  const notAuthorizedCount = logs.filter(l => l.result === 'NOT_AUTHORIZED').length;

  const todayStr = getTodayISODate();
  const todayLogs = logs.filter(l => isMatchingFilterDate(l.checkedAt, todayStr));
  const todayAuthorized = todayLogs.filter(l => l.result === 'AUTHORIZED').length;
  const todayNotAuthorized = todayLogs.filter(l => l.result === 'NOT_AUTHORIZED').length;

  return {
    activeList,
    activeListsCount: activeLists.length,
    latestList,
    totalLists: lists.length,
    activeEmployeesCount: totalActiveEmployees,
    totalVerifications: logs.length,
    authorizedCount,
    notAuthorizedCount,
    todayVerifications: todayLogs.length,
    todayAuthorized,
    todayNotAuthorized,
    recentLogs: logs.slice(0, 10),
    recentLists: lists.slice(0, 5)
  };
}

/**
 * Audit Logs operations
 */
export async function getAuditLogs(): Promise<AuditLog[]> {
  return getLocal<AuditLog[]>(LOCAL_KEY_AUDIT, []);
}

export async function recordAuditLog(log: Omit<AuditLog, 'id'>): Promise<void> {
  const id = 'audit-' + Date.now();
  const fullLog: AuditLog = { ...log, id };

  const logs = getLocal<AuditLog[]>(LOCAL_KEY_AUDIT, []);
  logs.unshift(fullLog);
  setLocal(LOCAL_KEY_AUDIT, logs.slice(0, 500));

  try {
    await withTimeout(setDoc(doc(db, AUDIT_COLLECTION, id), fullLog), 1500);
  } catch {
    // Saved in local resilient store
  }
}

/**
 * Admin Management
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const local = getLocal<AdminUser[]>(LOCAL_KEY_ADMINS, []);
  if (local && local.length > 0) {
    return local;
  }

  // Fallback to Firestore if local storage is empty
  try {
    const snap = await withTimeout(getDocs(collection(db, ADMINS_COLLECTION)), 1500);
    if (!snap.empty) {
      const remoteAdmins: AdminUser[] = [];
      snap.forEach(d => remoteAdmins.push(d.data() as AdminUser));
      if (remoteAdmins.length > 0) {
        setLocal(LOCAL_KEY_ADMINS, remoteAdmins);
        return remoteAdmins;
      }
    }
  } catch {}

  setLocal(LOCAL_KEY_ADMINS, INITIAL_ADMINS);
  return INITIAL_ADMINS;
}

export async function addAdminUser(
  user: Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>,
  actingAdmin?: { id: string; name: string }
): Promise<AdminUser> {
  const id = 'admin-' + Date.now();
  const now = new Date().toISOString();
  const newAdmin: AdminUser = {
    ...user,
    id,
    createdAt: now,
    updatedAt: now
  };

  const admins = await getAdminUsers();
  admins.push(newAdmin);
  setLocal(LOCAL_KEY_ADMINS, admins);

  try {
    await withTimeout(setDoc(doc(db, ADMINS_COLLECTION, id), newAdmin), 1500);
  } catch {
    // Saved in local resilient store
  }

  broadcastStorageChange('add_admin');

  if (actingAdmin) {
    await recordAuditLog({
      adminId: actingAdmin.id,
      adminName: actingAdmin.name,
      action: 'إضافة مسؤول جديد',
      entityType: 'ADMIN_USER',
      entityId: id,
      details: `تم إنشاء حساب المشرف (${newAdmin.name} - ${newAdmin.email}) بدور (${newAdmin.role === 'super_admin' ? 'مدير عام' : newAdmin.role === 'admin' ? 'مسؤول تدقيق' : 'مشاهد'}).`,
      createdAt: now
    });
  }

  return newAdmin;
}

export async function updateAdminUser(
  id: string,
  updates: Partial<Omit<AdminUser, 'id' | 'createdAt'>>,
  actingAdmin?: { id: string; name: string }
): Promise<AdminUser> {
  const admins = await getAdminUsers();
  const index = admins.findIndex(a => a.id === id);

  if (index === -1) {
    throw new Error('المسؤول غير موجود في النظام.');
  }

  const existing = admins[index];

  // Safeguard: Do not allow removing the last active Super Admin
  if (updates.role && updates.role !== 'super_admin' && existing.role === 'super_admin') {
    const superAdmins = admins.filter(a => a.role === 'super_admin' && a.status === 'active' && a.id !== id);
    if (superAdmins.length === 0) {
      throw new Error('لا يمكن تغيير دور آخر مدير عام نشط في النظام.');
    }
  }

  if (updates.status === 'suspended' && existing.role === 'super_admin') {
    const activeSuperAdmins = admins.filter(a => a.role === 'super_admin' && a.status === 'active' && a.id !== id);
    if (activeSuperAdmins.length === 0) {
      throw new Error('لا يمكن تجميد أو تعطيل آخر مدير عام نشط في النظام.');
    }
  }

  const now = new Date().toISOString();
  const updatedAdmin: AdminUser = {
    ...existing,
    ...updates,
    updatedAt: now,
  };

  admins[index] = updatedAdmin;
  setLocal(LOCAL_KEY_ADMINS, admins);

  try {
    await withTimeout(updateDoc(doc(db, ADMINS_COLLECTION, id), updatedAdmin as any), 1500);
  } catch {
    // Local store updated
  }

  broadcastStorageChange('update_admin');

  if (actingAdmin) {
    await recordAuditLog({
      adminId: actingAdmin.id,
      adminName: actingAdmin.name,
      action: 'تعديل بيانات وصلاحيات مسؤول',
      entityType: 'ADMIN_USER',
      entityId: id,
      details: `تم تحديث بيانات وصلاحيات المشرف (${updatedAdmin.name} - ${updatedAdmin.email}).`,
      createdAt: now
    });
  }

  return updatedAdmin;
}

export async function deleteAdminUser(
  adminIdToDelete: string,
  actingAdmin: { id: string; name: string }
): Promise<void> {
  if (adminIdToDelete === actingAdmin.id) {
    throw new Error('لا يمكنك حذف حسابك الشخصي المسجل به حالياً.');
  }

  const admins = await getAdminUsers();
  const targetAdmin = admins.find(a => a.id === adminIdToDelete);

  if (!targetAdmin) {
    throw new Error('المسؤول المراد حذفه غير موجود.');
  }

  // Check if target is last active super_admin
  if (targetAdmin.role === 'super_admin') {
    const remainingSuper = admins.filter(a => a.role === 'super_admin' && a.id !== adminIdToDelete);
    if (remainingSuper.length === 0) {
      throw new Error('لا يمكن حذف آخر مدير عام (Super Admin) في النظام.');
    }
  }

  const updatedAdmins = admins.filter(a => a.id !== adminIdToDelete);
  setLocal(LOCAL_KEY_ADMINS, updatedAdmins);

  try {
    await withTimeout(deleteDoc(doc(db, ADMINS_COLLECTION, adminIdToDelete)), 1500);
  } catch {
    // Local store updated
  }

  broadcastStorageChange('delete_admin');

  await recordAuditLog({
    adminId: actingAdmin.id,
    adminName: actingAdmin.name,
    action: 'حذف مسؤول من النظام',
    entityType: 'ADMIN_USER',
    entityId: adminIdToDelete,
    details: `تم حذف المشرف (${targetAdmin.name} - ${targetAdmin.email}) ذو الدور (${targetAdmin.role}) نهائياً من النظام.`,
    createdAt: new Date().toISOString()
  });
}
