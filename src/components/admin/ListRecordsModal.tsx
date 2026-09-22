import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Search,
  Check,
  Archive,
  Trash2,
  Users,
  TrainTrack,
  MapPin,
  Calendar,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { EmployeeList, ParsedEmployeeItem, AdminUser } from '../../types';
import { getListEmployees } from '../../services/db';
import { formatArabicDateTime } from '../../utils/date';
import { canApproveLists, canDeleteLists } from '../../services/auth';

interface ListRecordsModalProps {
  isOpen: boolean;
  list: EmployeeList | null;
  onClose: () => void;
  onApprove: (listId: string) => Promise<void>;
  onArchive: (listId: string) => Promise<void>;
  onDelete: (list: EmployeeList) => void;
  currentAdmin: AdminUser;
}

export const ListRecordsModal: React.FC<ListRecordsModalProps> = ({
  isOpen,
  list,
  onClose,
  onApprove,
  onArchive,
  onDelete,
  currentAdmin,
}) => {
  const [employees, setEmployees] = useState<ParsedEmployeeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen && list) {
      setLoading(true);
      getListEmployees(list.id)
        .then((items) => {
          setEmployees(items);
        })
        .catch((err) => {
          console.error('Failed to load list employees:', err);
          setEmployees([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setEmployees([]);
      setSearch('');
    }
  }, [isOpen, list]);

  if (!isOpen || !list) return null;

  const filteredEmployees = employees.filter((emp) => {
    const term = search.toLowerCase();
    const matchesNum = emp.number.toLowerCase().includes(term);
    const matchesName = emp.name ? emp.name.toLowerCase().includes(term) : false;
    const matchesRoute = emp.allowedRoute ? emp.allowedRoute.toLowerCase().includes(term) : false;
    return matchesNum || matchesName || matchesRoute;
  });

  const isActive = list.status === 'active';
  const isArchived = list.status === 'archived';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#002B49] via-[#008269] to-[#D0A85C]" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#008269]/10 border border-[#008269]/20 text-[#008269] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-[#002B49]">
                  {list.title}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                  #{list.versionNumber}
                </span>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#008269]/15 text-[#008269] font-black text-xs border border-[#008269]/30">
                    <span className="w-2 h-2 rounded-full bg-[#008269] animate-pulse" />
                    <span>نشطة ومعتمدة</span>
                  </span>
                )}
                {isArchived && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200">
                    <span>مؤرشفة</span>
                  </span>
                )}
                {list.status === 'uploaded' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200">
                    <span>مرفوعة (بانتظار الاعتماد)</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                <span className="font-mono dir-ltr">{list.fileName}</span>
                <span>•</span>
                <span>تاريخ الرفع: {formatArabicDateTime(list.uploadedAt)}</span>
                {list.approvedBy && (
                  <>
                    <span>•</span>
                    <span className="text-[#008269] font-semibold">المعتمد: {list.approvedBy}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Stats Bar */}
        <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="البحث في القائمة بالرقم الوظيفي أو اسم الموظف أو محطة السفر..."
              className="w-full h-10 px-3 pr-9 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#008269]" />
              <span>إجمالي الموظفين:</span>
              <span className="font-black text-[#002B49] font-mono">{employees.length}</span>
            </div>
            {search && (
              <div className="px-3 py-2 rounded-xl bg-[#008269]/10 border border-[#008269]/20 text-[#008269] font-bold">
                نتائج البحث: <span className="font-mono">{filteredEmployees.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Employees Table Content */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <div className="w-8 h-8 border-3 border-[#008269] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              جاري تحميل سجلات الموظفين...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              لا توجد سجلات تطابق البحث
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-[#F4F7F9] border-b border-slate-200 text-[#002B49] font-bold z-10">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">الرقم الوظيفي (ID)</th>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">جهة / مسار السفر المسموح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400 text-[11px]">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-black text-[#002B49]">
                      <span className="px-2 py-0.5 rounded-md bg-[#002B49]/5 border border-[#002B49]/10">
                        {emp.number}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {emp.name || <span className="text-slate-400 font-normal italic">غير محدد</span>}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-700">
                      {emp.allowedRoute ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#008269]/10 text-[#008269] font-bold text-xs border border-[#008269]/20">
                          <TrainTrack className="w-3.5 h-3.5" />
                          <span>{emp.allowedRoute}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">كافة الخطوط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="pt-4 mt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canDeleteLists(currentAdmin) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(list);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>حذف القائمة نهائياً</span>
              </button>
            )}

            {isActive && canApproveLists(currentAdmin) && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  setActionLoading(true);
                  await onArchive(list.id);
                  setActionLoading(false);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-4 h-4 text-slate-500" />
                <span>أرشفة القائمة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              إغلاق
            </button>

            {!isActive && canApproveLists(currentAdmin) && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  setActionLoading(true);
                  await onApprove(list.id);
                  setActionLoading(false);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>اعتماد وتفعيل القائمة للتحقق</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
