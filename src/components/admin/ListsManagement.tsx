import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Archive,
  Check,
  Plus,
  Calendar,
  Users,
  Clock,
  ShieldCheck,
  Search,
  AlertCircle,
  Trash2,
  TrainTrack,
  CheckCheck,
  Eye,
  Sparkles
} from 'lucide-react';
import { EmployeeList, AdminUser } from '../../types';
import { formatArabicDateTime } from '../../utils/date';
import { approveEmployeeList, archiveEmployeeList, deleteEmployeeList, clearAllEmployeeLists } from '../../services/db';
import { canApproveLists, canDeleteLists, canUploadLists } from '../../services/auth';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ListRecordsModal } from './ListRecordsModal';

interface ListsManagementProps {
  lists: EmployeeList[];
  onOpenUpload: () => void;
  onRefresh: () => void;
  currentAdmin: AdminUser;
}

export const ListsManagement: React.FC<ListsManagementProps> = ({
  lists,
  onOpenUpload,
  onRefresh,
  currentAdmin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedListToDelete, setSelectedListToDelete] = useState<EmployeeList | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // List records inspection modal
  const [selectedListToInspect, setSelectedListToInspect] = useState<EmployeeList | null>(null);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleApprove = async (listId: string) => {
    setActionLoading(listId);
    try {
      await approveEmployeeList(listId, currentAdmin.name, false);
      showNotification('تم اعتماد وتفعيل القائمة بنجاح.');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الاعتماد');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (listId: string) => {
    setActionLoading(listId);
    try {
      await archiveEmployeeList(listId, currentAdmin.name);
      showNotification('تمت أرشفة القائمة بنجاح.');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الأرشفة');
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteDialog = (list: EmployeeList) => {
    setSelectedListToDelete(list);
    setIsDeleteModalOpen(true);
  };

  const openInspectModal = (list: EmployeeList) => {
    setSelectedListToInspect(list);
    setIsInspectModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedListToDelete) return;

    setIsDeleting(true);
    try {
      await deleteEmployeeList(selectedListToDelete.id, currentAdmin.name);
      setIsDeleteModalOpen(false);
      setSelectedListToDelete(null);
      showNotification(`تم حذف القائمة "${selectedListToDelete.title}" وتطهير سجلاتها فوراً من النظام.`);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حذف القائمة');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmClearAll = async () => {
    setIsClearingAll(true);
    try {
      await clearAllEmployeeLists(currentAdmin.name);
      setIsClearAllModalOpen(false);
      showNotification('تم تطهير وحذف كافة القوائم وسجلات الموظفين بالكامل.');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تطهير القوائم');
    } finally {
      setIsClearingAll(false);
    }
  };

  const filteredLists = lists.filter((l) =>
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeListsCount = lists.filter(l => l.status === 'active').length;
  const totalEmployeesAcrossLists = lists.reduce((sum, l) => sum + (l.totalRecords || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-4 rounded-xl bg-[#008269] text-white text-xs sm:text-sm font-bold shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-white/80 hover:text-white text-xs underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#008269] mb-1">
            <TrainTrack className="w-4 h-4" />
            <span>الشركة السعودية للخطوط الحديدية (سار) - إدارة القوائم المتعددة</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#002B49] flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#008269]" />
            <span>إدارة قوائم المصرح لهم بالصعود بأوامر إركاب</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            يمكنك رفع قوائم متعددة لمختلف الإدارات والقطاعات (سائقو القطارات، طواقم الركاب، التشغيل)، واعتمادها وتفعيلها فوراً أو حذفها في حال عدم الرغبة فيها.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {lists.length > 0 && canDeleteLists(currentAdmin) && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 text-xs font-bold transition-all cursor-pointer"
              title="تطهير وحذف كافة القوائم وسجلات الموظفين المخزنة"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>تطهير وحذف كافة القوائم</span>
            </button>
          )}

          {canUploadLists(currentAdmin) && (
            <button
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>رفع قائمة جديدة (.xlsx / .csv)</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#008269]/10 text-[#008269] flex items-center justify-center font-black">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">القوائم النشطة المعتمدة</div>
            <div className="text-lg font-black text-[#002B49]">{activeListsCount} قوائم نشطة</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#002B49]/10 text-[#002B49] flex items-center justify-center font-black">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">إجمالي الموظفين المسجلين</div>
            <div className="text-lg font-black text-[#002B49]">{totalEmployeesAcrossLists.toLocaleString('ar-SA')} موظف</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D0A85C]/15 text-[#9A7328] flex items-center justify-center font-black">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-bold">إجمالي القوائم بالنظام</div>
            <div className="text-lg font-black text-[#002B49]">{lists.length} قائمة</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث في القوائم باسم الملف أو العنوان..."
            className="w-full h-11 px-3 pr-10 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Lists Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#F4F7F9] border-b border-slate-200 text-[#002B49] font-bold">
                <th className="py-3.5 px-4">القائمة</th>
                <th className="py-3.5 px-4">تاريخ الرفع</th>
                <th className="py-3.5 px-4 text-center">عدد الموظفين</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">المعتمد / القائم بالرفع</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lists.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
                        <FileSpreadsheet className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-[#002B49] mb-1">لا توجد قوائم مرفوعة حالياً</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        النظام يعتمد حصرياً على القوائم المرفوعة والمعتمدة من قبل أصحاب الصلاحية. لم يتم رفع أي قوائم حتى الآن.
                      </p>
                      {canUploadLists(currentAdmin) && (
                        <button
                          onClick={onOpenUpload}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>رفع أول قائمة أوامر إركاب</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : filteredLists.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    لا توجد قوائم تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                filteredLists.map((list) => {
                  const isActive = list.status === 'active';
                  const isArchived = list.status === 'archived';

                  return (
                    <tr
                      key={list.id}
                      className={`hover:bg-[#F4F7F9]/80 transition-colors ${
                        isActive ? 'bg-[#008269]/5' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="font-black text-[#002B49] text-sm flex items-center gap-1.5">
                          <span>{list.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                            #{list.versionNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 dir-ltr text-right">
                          {list.fileName}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {formatArabicDateTime(list.uploadedAt)}
                      </td>

                      <td className="py-4 px-4 text-center font-mono font-black text-[#002B49] text-sm">
                        {list.totalRecords.toLocaleString('ar-SA')}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {isActive && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#008269]/15 text-[#008269] font-black text-xs border border-[#008269]/30">
                            <span className="w-2 h-2 rounded-full bg-[#008269] animate-pulse" />
                            <span>نشطة (Active)</span>
                          </span>
                        )}
                        {isArchived && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200">
                            <Archive className="w-3 h-3 text-slate-400" />
                            <span>مؤرشفة (Archived)</span>
                          </span>
                        )}
                        {list.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold text-xs border border-blue-200">
                            <span>معتمدة (Approved)</span>
                          </span>
                        )}
                        {list.status === 'validated' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200">
                            <span>تم التحقق (Validated)</span>
                          </span>
                        )}
                        {list.status === 'uploaded' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                            <span>مرفوعة (Uploaded)</span>
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-700 text-xs">
                        <div className="font-semibold text-[#002B49]">{list.approvedBy || list.uploadedBy}</div>
                        {list.approvedAt && (
                          <div className="text-[10px] text-slate-400">
                            اعتماد: {formatArabicDateTime(list.approvedAt)}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Inspect Records Button */}
                          <button
                            onClick={() => openInspectModal(list)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
                            title="استعراض موظفي القائمة والمسارات"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>استعراض</span>
                          </button>

                          {!isActive && canApproveLists(currentAdmin) && (
                            <button
                              onClick={() => handleApprove(list.id)}
                              disabled={actionLoading === list.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#008269] hover:bg-[#006854] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                              title="اعتماد هذه القائمة وتفعيلها للجمهور فوراً"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>اعتماد وتفعيل</span>
                            </button>
                          )}

                          {isActive && canApproveLists(currentAdmin) && (
                            <button
                              onClick={() => handleArchive(list.id)}
                              disabled={actionLoading === list.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                              title="أرشفة القائمة يدوياً"
                            >
                              <Archive className="w-3.5 h-3.5 text-slate-500" />
                              <span>أرشفة</span>
                            </button>
                          )}

                          {canDeleteLists(currentAdmin) && (
                            <button
                              onClick={() => openDeleteDialog(list)}
                              disabled={actionLoading === list.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 font-bold text-xs border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="حذف القائمة نهائياً"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* List Records Inspect Modal */}
      <ListRecordsModal
        isOpen={isInspectModalOpen}
        list={selectedListToInspect}
        onClose={() => {
          setIsInspectModalOpen(false);
          setSelectedListToInspect(null);
        }}
        onApprove={handleApprove}
        onArchive={handleArchive}
        onDelete={openDeleteDialog}
        currentAdmin={currentAdmin}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        list={selectedListToDelete}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setSelectedListToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#002B49]">تطهير وحذف كافة القوائم؟</h3>
                <p className="text-xs text-slate-500">عملية نهائية لتفريغ الذاكرة والتخزين بالكامل</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              سيتم حذف جميع القوائم الحالية ({lists.length} قائمة) ومسح كافة سجلات الموظفين المرتبطة بها فوراً وبشكل دائم. لن يتمكن أي موظف من التحقق حتى يتم رفع قائمة جديدة معتمدة.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={confirmClearAll}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isClearingAll ? 'جاري التطهير...' : 'تأكيد الحذف والتطهير الفوري'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

