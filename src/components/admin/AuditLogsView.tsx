import React from 'react';
import { ShieldCheck, History, UserCheck, FileCheck } from 'lucide-react';
import { AuditLog } from '../../types';
import { formatArabicDateTime } from '../../utils/date';

interface AuditLogsViewProps {
  logs: AuditLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#002B49] flex items-center gap-2">
          <History className="w-6 h-6 text-[#008269]" />
          <span>سجل العمليات الإدارية والتدقيق (Audit Logs)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          سجل غير قابل للتعديل يوثق جميع الإجراءات المتخذة على القوائم وإعدادات النظام لحوكمة البيانات.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#F4F7F9] border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4">الإجراء الإداري</th>
                <th className="py-3.5 px-4">المسؤول</th>
                <th className="py-3.5 px-4">التفاصيل</th>
                <th className="py-3.5 px-4">تاريخ ووقت الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    لا توجد سجلات تدقيق حالياً
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#002B49] flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-[#008269]" />
                        <span>{item.action}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        الكيان: {item.entityType}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.adminName}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 max-w-md">
                      {item.details}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {formatArabicDateTime(item.createdAt)}
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
