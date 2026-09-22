import React from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert, FileSpreadsheet, Users } from 'lucide-react';
import { EmployeeList } from '../../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  list: EmployeeList | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  list,
  onClose,
  onConfirm,
  isLoading,
}) => {
  if (!isOpen || !list) return null;

  const isActive = list.status === 'active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isActive ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-rose-800 tracking-wide mb-1">
              إجراء غير قابل للتراجع
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[#002B49]">
              تأكيد حذف قائمة المصرح لهم بالصعود
            </h3>
          </div>
        </div>

        {/* Active List Warning Banner */}
        {isActive && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <strong className="font-black block text-rose-950 mb-1">
                تنبيه عالي الأهمية: هذه هي القائمة النشطة حالياً!
              </strong>
              حذف هذه القائمة سيلغي صلاحية الفحص فوراً ولن يتمكن نظام البوابة من التحقق من موظفيها حتى يتم تفعيل قائمة بديلة.
            </div>
          </div>
        )}

        {/* List Info Card */}
        <div className="bg-[#F4F7F9] border border-slate-200 rounded-xl p-4 mb-6 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-500 font-semibold">عنوان القائمة:</span>
            <span className="font-black text-[#002B49] text-sm">{list.title}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-500 font-semibold">اسم الملف:</span>
            <span className="font-mono text-slate-700 dir-ltr font-bold">{list.fileName}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-slate-500 font-semibold">عدد الموظفين المسجلين:</span>
            <span className="font-mono font-black text-[#008269] text-sm">
              {list.totalRecords.toLocaleString('ar-SA')} موظف
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold">حالة القائمة:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
              isActive 
                ? 'bg-[#008269]/15 text-[#008269] border border-[#008269]/30' 
                : 'bg-slate-200 text-slate-700'
            }`}>
              {isActive ? 'نشطة (Active)' : list.status}
            </span>
          </div>
        </div>

        {/* Confirmation Question */}
        <p className="text-xs sm:text-sm text-slate-600 mb-6 font-medium">
          هل أنت متأكد من رغبتك في إزالة هذه القائمة وجميع بيانات موظفيها وسجلاتها نهائياً من قاعدة البيانات؟
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            تراجع وإلغاء
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>جاري الحذف...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>نعم، حذف القائمة نهائياً</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
