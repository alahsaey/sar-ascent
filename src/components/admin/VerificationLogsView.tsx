import React, { useState } from 'react';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Laptop
} from 'lucide-react';
import { VerificationLog } from '../../types';
import { formatArabicDateTime } from '../../utils/date';
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

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.employeeNumber.includes(searchTerm.trim());
    const matchesResult = resultFilter === 'ALL' || log.result === resultFilter;
    const matchesDate = !dateFilter || log.checkedAt.startsWith(dateFilter);
    return matchesSearch && matchesResult && matchesDate;
  });

  const handleExport = () => {
    const exportData = filteredLogs.map((l) => ({
      'الرقم الوظيفي': l.employeeNumber,
      'اسم الموظف': l.employeeName || 'غير محدد',
      'جهة ومسار السفر': l.allowedRoute || 'كافة الخطوط',
      'النتيجة': l.result === 'AUTHORIZED' ? 'مصرح له الصعود بأمر إركاب' : 'ليس لديه أمر إركاب موظف',
      'تاريخ ووقت التحقق': formatArabicDateTime(l.checkedAt),
      'القائمة المستخدمة': l.listTitle,
      'عنوان IP': l.ipAddress || 'محلي',
      'معرف المتصفح / الجهاز': l.userAgent || 'مجهول',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل_التحقق');
    XLSX.writeFile(workbook, `سجل_عمليات_التحقق_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            سجل تدقيق رقابي لجميع محاولات التحقق من الأرقام الوظيفية لأوامر الإركاب ونتائجها وتوقيتاتها.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-[#002B49] transition-colors cursor-pointer"
            title="تحديث البيانات"
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

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث بالرقم الوظيفي..."
            className="w-full h-10 px-3 pr-9 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>

        {/* Result Filter */}
        <div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as any)}
            className="w-full h-10 px-3 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-medium text-slate-700"
          >
            <option value="ALL">جميع النتائج (الكل)</option>
            <option value="AUTHORIZED">مصرح له الصعود بأمر إركاب فقط</option>
            <option value="NOT_AUTHORIZED">ليس لديه أمر إركاب موظف فقط</option>
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono text-slate-700"
          />
        </div>
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
                <th className="py-3.5 px-4">القائمة المستخدمة</th>
                <th className="py-3.5 px-4">الجهاز / المتصفح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا توجد سجلات تطابق عوامل التصفية
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
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
                      {formatArabicDateTime(log.checkedAt)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
