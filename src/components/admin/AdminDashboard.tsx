import React from 'react';
import {
  Users,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  FileUp,
  Download,
  TrainTrack
} from 'lucide-react';
import { EmployeeList, VerificationLog } from '../../types';
import { formatArabicDateTime } from '../../utils/date';
import { generateSampleExcelTemplate } from '../../services/excel';

interface AdminDashboardProps {
  stats: {
    activeList: EmployeeList | null;
    latestList: EmployeeList | null;
    totalLists: number;
    activeEmployeesCount: number;
    totalVerifications: number;
    authorizedCount: number;
    notAuthorizedCount: number;
    recentLogs: VerificationLog[];
  };
  onOpenUpload: () => void;
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  stats,
  onOpenUpload,
  onNavigateTab,
}) => {
  const {
    activeList,
    latestList,
    activeEmployeesCount,
    totalVerifications,
    authorizedCount,
    notAuthorizedCount,
    recentLogs,
  } = stats;

  const authPercent = totalVerifications > 0
    ? Math.round((authorizedCount / totalVerifications) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome with SAR Colors */}
      <div className="bg-gradient-to-r from-[#002B49] to-[#001D33] rounded-3xl p-6 sm:p-7 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-4 border-[#008269]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008269]/30 text-[#A0D1C7] text-xs font-bold mb-2.5 border border-[#008269]/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>نظام أوامر إركاب الموظفين - سار (SAR) يعمل بصورة طبيعية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            لوحة قيادة ومتابعة أوامر إركاب الموظفين
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
            متابعة القوائم المعتمدة لأوامر إركاب الموظفين وإحصائيات التحقق اللحظية لضمان دقة مطابقة الأرقام الوظيفية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={generateSampleExcelTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#D0A85C]" />
            <span>تحميل نموذج Excel</span>
          </button>

          <button
            id="btn-dashboard-upload-list"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>رفع قائمة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Employees in active list */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold text-[#002B49]">موظفو القائمة النشطة</span>
            <div className="w-9 h-9 rounded-xl bg-[#008269]/10 text-[#008269] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#002B49] font-mono">
            {activeEmployeesCount.toLocaleString('ar-SA')}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#008269]" />
            <span className="font-bold text-[#008269] truncate">
              {activeList ? activeList.title : 'لا توجد قائمة نشطة'}
            </span>
          </div>
        </div>

        {/* Metric 2: Total verifications */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold text-[#002B49]">إجمالي عمليات التحقق</span>
            <div className="w-9 h-9 rounded-xl bg-[#002B49]/10 text-[#002B49] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#002B49] font-mono">
            {totalVerifications.toLocaleString('ar-SA')}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            سجل التدقيق والمطابقة الشامل
          </div>
        </div>

        {/* Metric 3: Authorized count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold text-[#002B49]">مصرح لهم بالصعود</span>
            <div className="w-9 h-9 rounded-xl bg-[#008269]/10 text-[#008269] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#008269] font-mono">
            {authorizedCount.toLocaleString('ar-SA')}
          </div>
          <div className="mt-2 text-xs font-bold text-[#008269] flex items-center gap-1">
            <span>نسبة المطابقة: {authPercent}%</span>
          </div>
        </div>

        {/* Metric 4: Not authorized count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold text-[#002B49]">ليس لديهم أمر إركاب</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-800 font-mono">
            {notAuthorizedCount.toLocaleString('ar-SA')}
          </div>
          <div className="mt-2 text-xs font-semibold text-rose-700">
            أرقام غير مسجلة في القائمة المعتمدة
          </div>
        </div>
      </div>

      {/* Active List Card Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-black text-[#002B49] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#008269]" />
              <span>تفاصيل القائمة المعتمدة والنشطة حالياً في سار (SAR)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              هذه هي القائمة المعتمدة رسمياً لعمليات فحص تصاريح السفر للموظفين في الوقت الفعلي
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#008269]/15 text-[#008269] font-bold text-xs border border-[#008269]/30">
              <span className="w-2 h-2 rounded-full bg-[#008269] animate-pulse" />
              <span>نشطة ومعتمدة</span>
            </span>
            <button
              onClick={() => onNavigateTab('lists')}
              className="text-xs font-bold text-[#008269] hover:text-[#005544] flex items-center gap-1 cursor-pointer"
            >
              <span>جميع القوائم</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {activeList ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-2">
            <div className="bg-[#F4F7F9] p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">اسم الملف</div>
              <div className="text-xs font-bold text-[#002B49] truncate mt-1 dir-ltr text-right">
                {activeList.fileName}
              </div>
            </div>

            <div className="bg-[#F4F7F9] p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">تاريخ ووقت الرفع</div>
              <div className="text-xs font-bold text-slate-700 mt-1">
                {formatArabicDateTime(activeList.uploadedAt)}
              </div>
            </div>

            <div className="bg-[#F4F7F9] p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">تاريخ ووقت الاعتماد</div>
              <div className="text-xs font-bold text-[#008269] mt-1">
                {formatArabicDateTime(activeList.approvedAt)}
              </div>
            </div>

            <div className="bg-[#F4F7F9] p-3.5 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">المعتمد بواسطة</div>
              <div className="text-xs font-bold text-[#002B49] mt-1">
                {activeList.approvedBy || activeList.uploadedBy}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs">
            لا توجد قائمة نشطة حالياً. يرجى رفع قائمة جديدة واعتمادها.
          </div>
        )}
      </div>

      {/* Recent Verification Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-[#002B49] flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-700" />
              <span>آخر عمليات التحقق</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحديث فوري لعمليات البحث التي يجريها الموظفون عبر البوابة
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs font-bold text-[#008269] hover:text-[#005544] flex items-center gap-1 cursor-pointer"
          >
            <span>عرض السجل الكامل</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold bg-[#F4F7F9]">
                <th className="py-3 px-3">الرقم الوظيفي</th>
                <th className="py-3 px-3">اسم الموظف</th>
                <th className="py-3 px-3">النتيجة</th>
                <th className="py-3 px-3">تاريخ ووقت التحقق</th>
                <th className="py-3 px-3">القائمة المستخدمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    لا توجد عمليات استعلام مسجلة حتى الآن
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#002B49] text-sm dir-ltr text-right">
                      {log.employeeNumber}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {log.employeeName || '-'}
                    </td>
                    <td className="py-3 px-3">
                      {log.result === 'AUTHORIZED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#008269]/15 text-[#008269] font-black text-[11px] border border-[#008269]/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#008269]" />
                          <span>مصرح له الصعود بأمر إركاب</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 font-bold text-[11px] border border-rose-300">
                          <XCircle className="w-3.5 h-3.5 text-rose-700" />
                          <span>ليس لديه أمر إركاب موظف</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {formatArabicDateTime(log.checkedAt)}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-xs">
                      {log.listTitle}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
