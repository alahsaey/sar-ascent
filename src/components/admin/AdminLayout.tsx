import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Clock,
  History,
  Users,
  LogOut,
  ArrowRight,
  Shield,
  ShieldCheck,
  FileUp,
  ExternalLink,
  ChevronDown,
  TrainTrack
} from 'lucide-react';
import { AdminUser, EmployeeList, VerificationLog, AuditLog } from '../../types';
import { AdminDashboard } from './AdminDashboard';
import { ListsManagement } from './ListsManagement';
import { VerificationLogsView } from './VerificationLogsView';
import { AuditLogsView } from './AuditLogsView';
import { AdminUsersView } from './AdminUsersView';
import { SarLogo } from '../SarLogo';
import { ListUploadModal } from './ListUploadModal';
import {
  getDashboardStats,
  getAllEmployeeLists,
  getVerificationLogs,
  getAuditLogs,
  getAdminUsers,
} from '../../services/db';

interface AdminLayoutProps {
  currentAdmin: AdminUser;
  onLogout: () => void;
  onGoToPublicPortal: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentAdmin,
  onLogout,
  onGoToPublicPortal,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lists' | 'logs' | 'audit' | 'admins'>('dashboard');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState<{
    activeList: EmployeeList | null;
    latestList: EmployeeList | null;
    totalLists: number;
    activeEmployeesCount: number;
    totalVerifications: number;
    authorizedCount: number;
    notAuthorizedCount: number;
    recentLogs: VerificationLog[];
  }>({
    activeList: null,
    latestList: null,
    totalLists: 0,
    activeEmployeesCount: 0,
    totalVerifications: 0,
    authorizedCount: 0,
    notAuthorizedCount: 0,
    recentLogs: [],
  });

  const [lists, setLists] = useState<EmployeeList[]>([]);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dashStats, allLists, allLogs, allAudit, allAdmins] = await Promise.all([
        getDashboardStats(),
        getAllEmployeeLists(),
        getVerificationLogs(),
        getAuditLogs(),
        getAdminUsers(),
      ]);

      setStats(dashStats);
      setLists(allLists);
      setLogs(allLogs);
      setAuditLogs(allAudit);
      setAdminUsers(allAdmins);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();

    const handleStorageChange = () => {
      loadAllData();
    };

    window.addEventListener('sar-storage-changed', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('sar-storage-changed', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isSuper = currentAdmin.role === 'super_admin';
  const canManageUsers = isSuper || currentAdmin.permissions?.canManageAdmins;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F9] text-[#002B49]">
      {/* Top Bar Header - SAR Deep Navy with Emerald Accent */}
      <header className="bg-[#002B49] text-white border-b-4 border-[#008269] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Official SAR Logo */}
            <SarLogo variant="horizontal" theme="white" size="sm" />

            <div className="hidden md:block h-6 w-px bg-white/20" />

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold text-[#D0A85C]">
                لوحة التحكم الإدارية
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#008269] text-white font-black">
                {isSuper ? 'مدير عام' : 'مسؤول تدقيق'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onGoToPublicPortal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors cursor-pointer"
              title="الانتقال إلى واجهة فحص أمر إركاب الموظفين"
            >
              <span>بوابة الموظف</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#D0A85C]" />
            </button>

            <div className="h-6 w-px bg-white/20 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-left text-xs">
                <div className="font-bold text-white">{currentAdmin.name}</div>
                <div className="text-[10px] text-slate-300 font-mono">{currentAdmin.email}</div>
              </div>

              <button
                id="btn-admin-logout"
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-rose-600/80 transition-colors cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-[#00223A] border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
            <button
              id="tab-btn-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#008269] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>لوحة القيادة (Dashboard)</span>
            </button>

            <button
              id="tab-btn-lists"
              onClick={() => setActiveTab('lists')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'lists'
                  ? 'bg-[#008269] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>إدارة القوائم ({lists.length})</span>
            </button>

            <button
              id="tab-btn-logs"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-[#008269] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>سجل عمليات التحقق ({logs.length})</span>
            </button>

            <button
              id="tab-btn-audit"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#008269] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل التدقيق والعمليات</span>
            </button>

            {canManageUsers && (
              <button
                id="tab-btn-admins"
                onClick={() => setActiveTab('admins')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'admins'
                    ? 'bg-[#008269] text-white shadow-xs'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>إدارة المشرفين ({adminUsers.length})</span>
              </button>
            )}

            {/* Firewall Active Shield Badge */}
            <div className="mr-auto hidden md:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span className="font-bold text-white">جدار الحماية الفوري نشط</span>
              <span className="text-[10px] text-emerald-200/80 bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono">WAF Protected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="w-8 h-8 border-3 border-[#008269] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <AdminDashboard
                stats={stats}
                onOpenUpload={() => setIsUploadModalOpen(true)}
                onNavigateTab={(t: any) => setActiveTab(t)}
              />
            )}

            {activeTab === 'lists' && (
              <ListsManagement
                lists={lists}
                onOpenUpload={() => setIsUploadModalOpen(true)}
                onRefresh={loadAllData}
                currentAdmin={currentAdmin}
              />
            )}

            {activeTab === 'logs' && (
              <VerificationLogsView
                logs={logs}
                onRefresh={loadAllData}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLogsView logs={auditLogs} />
            )}

            {activeTab === 'admins' && (
              <AdminUsersView
                admins={adminUsers}
                onRefresh={loadAllData}
                currentAdmin={currentAdmin}
              />
            )}
          </>
        )}
      </main>

      {/* Upload Modal */}
      <ListUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onListCreated={loadAllData}
        currentAdmin={currentAdmin}
      />
    </div>
  );
};
