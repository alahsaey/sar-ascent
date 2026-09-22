import React, { useState, useMemo } from 'react';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Laptop,
  Cloud,
  CloudUpload,
  Check,
  AlertCircle,
  Database,
  Calendar,
  X,
  Sparkles
} from 'lucide-react';
import { VerificationLog } from '../../types';
import {
  formatArabicDateTime,
  formatArabicDateTimeWithSeconds,
  isMatchingFilterDate,
  getTodayISODate,
  getYesterdayISODate
} from '../../utils/date';
import { migrateLocalLogsToFirestore } from '../../services/db';
import * as XLSX from 'xlsx';

interface VerificationLogsViewProps {
  logs: VerificationLog[];
  onRefresh: () => void;
}

export const VerificationLogsView: React.FC<VerificationLogsViewProps> = ({
  logs,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'AUTHORIZED' | 'NOT_AUTHORIZED'>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });

  const todayStr = useMemo(() => getTodayISODate(), []);
  const yesterdayStr = useMemo(() => getYesterdayISODate(), []);

  // Quick stats
  const todayCount = useMemo(() => {
    return logs.filter((l) => isMatchingFilterDate(l.checkedAt, todayStr)).length;
  }, [logs, todayStr]);

  const yesterdayCount = useMemo(() => {
    return logs.filter((l) => isMatchingFilterDate(l.checkedAt, yesterdayStr)).length;
  }, [logs, yesterdayStr]);

  // Robust timezone-aware filter
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchTerm.trim();
      const matchesSearch = !q || (log.employeeNumber && log.employeeNumber.includes(q)) || (log.employeeName && log.employeeName.includes(q));
      const matchesResult = resultFilter === 'ALL' || log.result === resultFilter;
      const matchesDate = !dateFilter || isMatchingFilterDate(log.checkedAt, dateFilter);
      return matchesSearch && matchesResult && matchesDate;
    });
  }, [logs, searchTerm, resultFilter, dateFilter]);

  const handleManualMigration = async () => {
    setIsMigrating(true);
    setMigrationStatus({ type: 'idle' });
    try {
      const res = await migrateLocalLogsToFirestore();
      if (res.success) {
        setMigrationStatus({
          type: 'success',
          message: res.message || `تم بنجاح ترحيل ومزامنة ${res.migratedCount} سجل إلى السحابة.`
        });
        onRefresh();
      } else {
        setMigrationStatus({
          type: 'error',
          message: res.message || 'حدث خطأ أثناء ترحيل السجلات.'
        });
      }
    } catch {
      setMigrationStatus({
        type: 'error',
        message: 'فشلت المزامنة. يرجى التأكد من اتصال الإنترنت.'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setResultFilter('ALL');
    setDateFilter('');
  };

  const isFilterActive = searchTerm !== '' || resultFilter !== 'ALL' || dateFilter !== '';

  const handleExport = () => {
    const exportData = filteredLogs.map((l) => ({
      'الرقم الوظيفي': l.employeeNumber,
      'اسم الموظف': l.employeeName || 'غير محدد',
      'جهة ومسار السفر': l.allowedRoute || 'كافة الخطوط',
      'النتيجة': l.result === 'AUTHORIZED' ? 'مصرح له الصعود بأمر إركاب' : 'ليس لديه أمر إركاب موظف',
      'تاريخ ووقت التحقق': formatArabicDateTimeWithSeconds(l.checkedAt),
      'القائمة المستخدمة': l.listTitle,
      'عنوان IP': l.ipAddress || 'محلي',
      'معرف المتصفح / الجهاز': l.userAgent || 'مجهول',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل_التحقق');
    XLSX.writeFile(workbook, `سجل_عمليات_التحقق_${dateFilter || 'شامل'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#002B49] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#008269]" />
            <span>سجل عمليات التحقق من أوامر إركاب الموظفين</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            سجل تدقيق مركزي موحد لجميع محاولات التحقق متزامن لحظياً وفورياً مع السحابة وكافة أجهزة المحطات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Cloud Migration Button */}
          <button
            onClick={handleManualMigration}
            disabled={isMigrating}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="ترحيل ومزامنة كافة السجلات المحلية من المتصفح إلى السحابة المركزية"
          >
            {isMigrating ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <CloudUpload className="w-4 h-4 text-emerald-600" />
            )}
            <span>{isMigrating ? 'جاري الترحيل...' : 'ترحيل ومزامنة السحابة'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-[#002B49] transition-colors cursor-pointer"
            title="تحديث البيانات السحابية"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#002B49] hover:bg-[#001B2E] text-white text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#002B49]"
          >
            <Download className="w-4 h-4 text-[#D0A85C]" />
            <span>تصدير السجل إلى Excel</span>
          </button>
        </div>
      </div>

      {/* Cloud Status Notice */}
      {migrationStatus.type !== 'idle' && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
            migrationStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {migrationStatus.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{migrationStatus.message}</span>
          </div>
          <button
            onClick={() => setMigrationStatus({ type: 'idle' })}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Cloud Synchronization Status Card */}
      <div className="bg-gradient-to-r from-[#F4F7F9] to-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#008269]/10 text-[#008269] flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#002B49]">قاعدة البيانات السحابية المركزية (Firestore)</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                مزامنة حية وموحدة
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              يتم حفظ واسترجاع جميع استعلامات أوامر الإركاب تلقائياً عبر السحابة لضمان عرض تقرير تدقيق دقيق وشامل لكافة التواريخ.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0 font-mono text-xs">
          <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-800">
            سجلات اليوم: <span className="font-bold">{todayCount.toLocaleString('ar-SA')}</span>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-slate-700">
            إجمالي السجلات: <span className="font-bold text-[#002B49]">{logs.length.toLocaleString('ar-SA')}</span>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 ml-1">
          <Filter className="w-3.5 h-3.5" />
          <span>تصفية سريعة:</span>
        </span>

        {/* All Dates */}
        <button
          onClick={() => setDateFilter('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            dateFilter === ''
              ? 'bg-[#002B49] text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          كافة التواريخ
        </button>

        {/* Today */}
        <button
          onClick={() => setDateFilter(todayStr)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
            dateFilter === todayStr
              ? 'bg-[#008269] text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>سجلات اليوم</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            dateFilter === todayStr ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {todayCount}
          </span>
        </button>

        {/* Yesterday */}
        <button
          onClick={() => setDateFilter(yesterdayStr)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
            dateFilter === yesterdayStr
              ? 'bg-[#008269] text-white shadow-2xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>سجلات أمس</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            dateFilter === yesterdayStr ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {yesterdayCount}
          </span>
        </button>

        {/* Clear filters button if active */}
        {isFilterActive && (
          <button
            onClick={resetFilters}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors inline-flex items-center gap-1 mr-auto cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>مسح جميع الفلاتر</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث بالرقم الوظيفي أو الاسم..."
            className="w-full h-10 px-3 pr-9 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Result Filter */}
        <div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as any)}
            className="w-full h-10 px-3 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">جميع نتائج التحقق (الكل)</option>
            <option value="AUTHORIZED">مصرح له الصعود بأمر إركاب فقط</option>
            <option value="NOT_AUTHORIZED">ليس لديه أمر إركاب موظف فقط</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="relative flex items-center">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono text-slate-700 cursor-pointer"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="absolute left-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              title="إلغاء تصفية التاريخ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results Count Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          المعروض: <span className="font-bold text-[#002B49] font-mono">{filteredLogs.length.toLocaleString('ar-SA')}</span> من إجمالي <span className="font-mono">{logs.length.toLocaleString('ar-SA')}</span> سجل
        </div>
        {dateFilter && (
          <div className="text-[#008269] font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>محدد لتاريخ: {dateFilter === todayStr ? 'اليوم' : dateFilter === yesterdayStr ? 'أمس' : dateFilter}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#F4F7F9] border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4">الرقم الوظيفي</th>
                <th className="py-3.5 px-4">اسم الموظف</th>
                <th className="py-3.5 px-4">جهة ومسار السفر</th>
                <th className="py-3.5 px-4">نتيجة التحقق</th>
                <th className="py-3.5 px-4">تاريخ ووقت التحقق</th>
                <th className="py-3.5 px-4">القائمة المعتمدة</th>
                <th className="py-3.5 px-4">الجهاز / المتصفح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-600 text-sm">لا توجد سجلات تطابق عوامل التصفية المحددة</p>
                      <p className="text-xs text-slate-400">
                        {dateFilter === todayStr
                          ? 'لم يتم تسجيل أي عمليات استعلام في تاريخ اليوم حتى الآن.'
                          : 'جرّب تغيير التاريخ أو اختيار "كافة التواريخ".'}
                      </p>
                      {isFilterActive && (
                        <button
                          onClick={resetFilters}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          عرض كافة السجلات
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isToday = isMatchingFilterDate(log.checkedAt, todayStr);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#002B49] text-sm dir-ltr text-right">
                        {log.employeeNumber}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {log.employeeName ? (
                          log.employeeName
                        ) : (
                          <span className="text-slate-400 font-normal italic">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {log.allowedRoute ? (
                          <span className="text-[11px] font-bold text-[#7E5B27] bg-[#FAF5EB] px-2 py-0.5 rounded border border-[#EBD5A0]">
                            {log.allowedRoute}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.result === 'AUTHORIZED' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8F4] text-[#005443] font-bold text-xs border border-[#8EDECB]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#008269]" />
                            <span>مصرح له الصعود بأمر إركاب</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3F2] text-[#800A1D] font-bold text-xs border border-[#FDA29B]">
                            <XCircle className="w-3.5 h-3.5 text-[#C8102E]" />
                            <span>ليس لديه أمر إركاب موظف</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{formatArabicDateTimeWithSeconds(log.checkedAt)}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              اليوم
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-semibold text-[#002B49]">{log.listTitle}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        <span title={log.userAgent}>
                          {log.userAgent ? log.userAgent.split(')')[0] + ')' : 'متصفح ويب'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

