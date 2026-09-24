export type ListStatus = 'uploaded' | 'validated' | 'approved' | 'active' | 'archived';

export type AdminRole = 'super_admin' | 'admin' | 'viewer';

export interface AdminPermissions {
  canUploadLists: boolean;
  canApproveLists: boolean;
  canDeleteLists: boolean;
  canManageAdmins: boolean;
  canViewAuditLogs: boolean;
  canExportLogs: boolean;
}

export interface EmployeeList {
  id: string;
  fileName: string;
  fileType: 'xlsx' | 'csv';
  versionNumber: number;
  title: string;
  totalRecords: number;
  status: ListStatus;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  notes?: string;
}

export interface EmployeeRecord {
  id: string;
  employeeNumber: string; // Strictly string to preserve leading zeros
  employeeName?: string; // Employee full name
  allowedRoute?: string; // Allowed travel sector / location (e.g. "Between( RIY& DMM & HUFOF )")
  department?: string; // Department / team / CDS
  listId: string;
  createdAt: string;
}

export interface VerificationResult {
  authorized: boolean;
  message: string;
  lastUpdated: string;
  listTitle: string;
  listVersion: number;
  employeeNumber: string;
  employeeName?: string;
  allowedRoute?: string;
  department?: string;
  checkedAt?: string;
}

export interface VerificationLog {
  id: string;
  employeeNumber: string;
  employeeName?: string;
  allowedRoute?: string;
  result: 'AUTHORIZED' | 'NOT_AUTHORIZED';
  listId: string;
  listTitle: string;
  checkedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  pinCode?: string; // Secret PIN / passcode (alphanumeric, supporting both letters and numbers)
  pinHash?: string; // SHA-256 salted hash of the PIN
  pinSalt?: string; // Cryptographic salt unique to this administrator
  integritySignature?: string; // Cryptographic signature guarding against database & local tampering
  isTampered?: boolean; // Flagged if integrity signature does not match
  role: AdminRole;
  permissions: AdminPermissions;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface ParsedEmployeeItem {
  number: string;
  name?: string;
  allowedRoute?: string;
  department?: string;
}

export interface ExcelColumnInfo {
  index: number;
  label: string;
  sampleValues: string[];
}

export interface ExcelImportSummary {
  fileName: string;
  fileType: 'xlsx' | 'csv';
  totalRowsFound: number;
  validEmployeeNumbers: string[];
  validEmployees: ParsedEmployeeItem[];
  duplicateCount: number;
  emptyRowsCount: number;
  sampleData: string[];
  sampleDataWithNames: ParsedEmployeeItem[];
  columnDetected: string;
  nameColumnDetected?: string;
  routeColumnDetected?: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  idColIndex: number;
  nameColIndex: number;
  routeColIndex: number;
  availableColumns: ExcelColumnInfo[];
  rawRows: string[][];
  warnings: string[];
}
