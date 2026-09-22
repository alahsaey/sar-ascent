import React, { useState } from 'react';
import {
  Shield,
  UserPlus,
  Users,
  Check,
  AlertCircle,
  KeyRound,
  Mail,
  User,
  Trash2,
  Edit,
  Sliders,
  CheckCircle2,
  Lock,
  Hash,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
  FileSpreadsheet,
  CheckSquare,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Info
} from 'lucide-react';
import { AdminUser, AdminRole, AdminPermissions } from '../../types';
import { addAdminUser, updateAdminUser, deleteAdminUser, getDefaultPermissions } from '../../services/db';
import { sha256 } from '../../services/auth';
import { formatArabicDateTime } from '../../utils/date';

interface AdminUsersViewProps {
  admins: AdminUser[];
  onRefresh: () => void;
  currentAdmin: AdminUser;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  admins,
  onRefresh,
  currentAdmin,
}) => {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminUser | null>(null);

  // Form states for Add / Edit
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [permissions, setPermissions] = useState<AdminPermissions>(getDefaultPermissions('admin'));
  const [showPinInTable, setShowPinInTable] = useState<Record<string, boolean>>({});

  // Feedback states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Reset Add Form
  const openAddModal = () => {
    setName('');
    setEmail('');
    setPassword('');
    setPinCode('');
    setRole('admin');
    setStatus('active');
    setPermissions(getDefaultPermissions('admin'));
    setError(null);
    setShowAddModal(true);
  };

  // Open Edit Form
  const openEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setName(admin.name);
    setEmail(admin.email);
    setPassword(''); // leave blank if not changing
    setPinCode(admin.pinCode || '');
    setRole(admin.role);
    setStatus(admin.status || 'active');
    setPermissions(admin.permissions || getDefaultPermissions(admin.role));
    setError(null);
  };

  // Handle role change to set smart default permissions
  const handleRoleChange = (newRole: AdminRole) => {
    setRole(newRole);
    setPermissions(getDefaultPermissions(newRole));
  };

  // Toggle individual permission
  const handlePermissionToggle = (key: keyof AdminPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Add New Admin Handler
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول الإلزامية.');
      return;
    }

    if (pinCode.trim().length < 4) {
      setError('يجب أن يتكون الرقم السري (PIN) من 4 أرقام على الأقل.');
      return;
    }

    // Check duplicate email
    if (admins.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) {
      setError('هذا البريد الإلكتروني مسجل بالفعل لمسؤول آخر.');
      return;
    }

    setSubmitting(true);
    try {
      const passwordHash = await sha256(password.trim());

      await addAdminUser(
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          pinCode: pinCode.trim(),
          role,
          permissions,
          status,
        },
        { id: currentAdmin.id, name: currentAdmin.name }
      );

      setShowAddModal(false);
      onRefresh();
      showToast(`تمت إضافة المسؤول (${name.trim()}) بنجاح وتعيين الصلاحيات.`);
    } catch (err: any) {
      setError(err.message || 'فشل إضافة المشرف.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Admin Handler
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('يرجى ملء الاسم والبريد الإلكتروني.');
      return;
    }

    if (pinCode.trim().length < 4) {
      setError('يجب أن يتكون الرقم السري من 4 خانات على الأقل.');
      return;
    }

    // Check duplicate email if changed
    if (
      admins.some(
        a => a.id !== editingAdmin.id && a.email.toLowerCase() === email.trim().toLowerCase()
      )
    ) {
      setError('هذا البريد الإلكتروني مسجل بالفعل لمسؤول آخر.');
      return;
    }

    setSubmitting(true);
    try {
      const updates: Partial<AdminUser> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        pinCode: pinCode.trim(),
        role,
        permissions,
        status,
      };

      if (password.trim()) {
        updates.passwordHash = await sha256(password.trim());
      }

      await updateAdminUser(editingAdmin.id, updates, {
        id: currentAdmin.id,
        name: currentAdmin.name,
      });

      setEditingAdmin(null);
      onRefresh();
      showToast(`تم تحديث بيانات وصلاحيات المسؤول (${name.trim()}) بنجاح.`);
    } catch (err: any) {
      setError(err.message || 'فشل تحديث بيانات المشرف.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Admin Handler
  const handleDelete = async () => {
    if (!deletingAdmin) return;
    setSubmitting(true);
    setError(null);

    try {
      await deleteAdminUser(deletingAdmin.id, {
        id: currentAdmin.id,
        name: currentAdmin.name,
      });

      setDeletingAdmin(null);
      onRefresh();
      showToast(`تم حذف حساب المسؤول (${deletingAdmin.name}) نهائياً من النظام.`);
    } catch (err: any) {
      setError(err.message || 'فشل حذف المشرف.');
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentSuper = currentAdmin.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#002B49] text-white px-5 py-3.5 rounded-2xl shadow-xl border border-[#008269] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-[#008269] shrink-0" />
          <span className="text-xs font-bold leading-relaxed">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#002B49] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#008269]" />
            <span>إدارة مسؤولي النظام وتوزيع الصلاحيات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            التحكم في حسابات المشرفين، الأرقام السرية (PIN)، وتخصيص صلاحيات الاعتماد والحذف والرفع.
          </p>
        </div>

        {isCurrentSuper && (
          <button
            id="btn-add-new-admin"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مسؤول جديد</span>
          </button>
        )}
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="font-bold text-xs text-[#002B49] flex items-center gap-2 mb-1.5">
            <Shield className="w-4 h-4 text-[#008269]" />
            <span>المدير العام (Super Admin)</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            صلاحيات كاملة غير مقيدة: إضافة وحذف المشرفين، تعيين الأرقام السرية، تفعيل وأرشفة وحذف القوائم، والاطلاع على سجلات التدقيق الشاملة.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="font-bold text-xs text-[#002B49] flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>مسؤول تدقيق (Admin)</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            رفع ملفات القوائم، التحقق ومطابقة السجلات، واعتماد القوائم الرسمية، وتصدير التقارير الإحصائية.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="font-bold text-xs text-[#002B49] flex items-center gap-2 mb-1.5">
            <UserCheck className="w-4 h-4 text-amber-600" />
            <span>مشاهد / مدقق (Viewer)</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            استعراض القوائم وسجلات الفحص اليومية ومتابعة مؤشرات الأداء فقط دون إمكانية التعديل أو الاعتماد.
          </p>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-[#002B49]">قائمة المشرفين المعتمدين</span>
            <span className="px-2 py-0.5 rounded-full bg-[#008269]/10 text-[#008269] text-[11px] font-bold">
              {admins.length} مشرفين
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            🔒 محمي بواسطة نظام التشفير والتفويض المعتمد
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4">اسم المسؤول</th>
                <th className="py-3.5 px-4">البريد الإلكتروني</th>
                <th className="py-3.5 px-4">الرقم السري (PIN)</th>
                <th className="py-3.5 px-4">الدور والصلاحيات</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin) => {
                const isCurrent = admin.id === currentAdmin.id;
                const isLastSuperAdmin =
                  admin.role === 'super_admin' &&
                  admins.filter(a => a.role === 'super_admin').length <= 1;
                const isShownPin = showPinInTable[admin.id];

                return (
                  <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4 font-bold text-[#002B49]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#008269]/10 border border-[#008269]/20 text-[#008269] flex items-center justify-center font-bold text-xs shrink-0">
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{admin.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#008269]/10 text-[#008269] rounded font-bold border border-[#008269]/20">
                                أنت
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 font-mono text-slate-600 dir-ltr text-right">
                      {admin.email}
                    </td>

                    {/* Secret PIN code */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="inline-flex items-center gap-1.5 bg-[#F4F7F9] px-2.5 py-1 rounded-lg border border-slate-200">
                        <Hash className="w-3 h-3 text-[#008269]" />
                        <span className="font-bold text-xs tracking-wider">
                          {isShownPin ? (admin.pinCode || 'غير محدد') : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setShowPinInTable(prev => ({
                              ...prev,
                              [admin.id]: !prev[admin.id],
                            }))
                          }
                          className="text-slate-400 hover:text-[#008269] p-0.5 transition-colors cursor-pointer"
                          title={isShownPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
                        >
                          {isShownPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    {/* Role & Permissions preview */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div>
                          {admin.role === 'super_admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 font-bold text-[11px] border border-emerald-300">
                              <Shield className="w-3 h-3 text-emerald-700" />
                              <span>مدير عام (Super Admin)</span>
                            </span>
                          ) : admin.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-950 font-bold text-[11px] border border-blue-300">
                              <ShieldCheck className="w-3 h-3 text-blue-700" />
                              <span>مسؤول تدقيق (Admin)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 font-bold text-[11px] border border-amber-300">
                              <UserCheck className="w-3 h-3 text-amber-700" />
                              <span>مشاهد (Viewer)</span>
                            </span>
                          )}
                        </div>

                        {/* Granular permission tags */}
                        <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                          {admin.permissions?.canUploadLists && (
                            <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">رفع</span>
                          )}
                          {admin.permissions?.canApproveLists && (
                            <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">اعتماد</span>
                          )}
                          {admin.permissions?.canDeleteLists && (
                            <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 rounded">حذف</span>
                          )}
                          {admin.permissions?.canManageAdmins && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded">إدارة مشرفين</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {admin.status === 'suspended' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                          <UserX className="w-3 h-3 text-rose-600" />
                          <span>معطل</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>نشط</span>
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {formatArabicDateTime(admin.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(admin)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#008269] hover:bg-[#008269]/10 transition-colors cursor-pointer"
                          title="تعديل بيانات وصلاحيات المسؤول"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          disabled={isCurrent || isLastSuperAdmin || !isCurrentSuper}
                          onClick={() => setDeletingAdmin(admin)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isCurrent || isLastSuperAdmin || !isCurrentSuper
                              ? 'text-slate-300 cursor-not-allowed opacity-50'
                              : 'text-rose-600 hover:text-rose-800 hover:bg-rose-50'
                          }`}
                          title={
                            isCurrent
                              ? 'لا يمكنك حذف حسابك الشخصي'
                              : isLastSuperAdmin
                              ? 'لا يمكن حذف آخر مدير عام في النظام'
                              : 'حذف المسؤول نهائياً'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD ADMIN MODAL WITH DETAILED PERMISSION DISTRIBUTION */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#008269]/10 text-[#008269] flex items-center justify-center mb-2">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-[#002B49]">
                إضافة مسؤول جديد للنظام
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد بيانات الاعتماد والرقم السري وتوزيع الصلاحيات بدقة
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#002B49] mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: فهد بن إبراهيم المنصور"
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#002B49] mb-1">البريد الإلكتروني الرسمي *</label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="f.mansoor@sar.com.sa"
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#002B49] mb-1">
                    الرقم السري للدخول السريع (PIN) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      dir="ltr"
                      maxLength={8}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="أدخل الرمز السري"
                      className="w-full h-10 px-3 pr-8 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono font-bold text-center tracking-wider"
                    />
                    <Hash className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يستخدم لتسجيل الدخول السريع في النظام
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-[#002B49] mb-1">كلمة المرور المؤقتة *</label>
                  <input
                    type="password"
                    required
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#002B49] mb-1">الدور الأساسي</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
                  className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-bold text-[#002B49]"
                >
                  <option value="admin">مسؤول تدقيق (Admin)</option>
                  <option value="super_admin">مدير عام (Super Admin)</option>
                  <option value="viewer">مشاهد / مدقق سجلات (Viewer)</option>
                </select>
              </div>

              {/* Granular Permission Matrix */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block font-bold text-[#002B49] mb-2 flex items-center justify-between">
                  <span>توزيع الصلاحيات التفصيلية (Custom Permissions)</span>
                  <span className="text-[10px] text-[#008269] font-normal">
                    يمكن تخصيص الصلاحيات حسب حاجة المشرف
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#F4F7F9] p-3 rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canUploadLists}
                      onChange={() => handlePermissionToggle('canUploadLists')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div>
                      <div className="font-bold text-[#002B49]">رفع ملفات وقوائم جديدة</div>
                      <div className="text-[10px] text-slate-500">رفع ملفات Excel و CSV للنظام</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canApproveLists}
                      onChange={() => handlePermissionToggle('canApproveLists')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div>
                      <div className="font-bold text-[#002B49]">اعتماد وتفعيل القوائم</div>
                      <div className="text-[10px] text-slate-500">جعل القائمة نشطة فوراً لفحص الموظفين</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canDeleteLists}
                      onChange={() => handlePermissionToggle('canDeleteLists')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div>
                      <div className="font-bold text-rose-700">حذف وأرشفة القوائم</div>
                      <div className="text-[10px] text-slate-500">حذف القوائم المرفوعة نهائياً</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canManageAdmins}
                      onChange={() => handlePermissionToggle('canManageAdmins')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div>
                      <div className="font-bold text-emerald-800">إدارة المشرفين والصلاحيات</div>
                      <div className="text-[10px] text-slate-500">إضافة وتعديل وحذف مسؤولي النظام</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canViewAuditLogs}
                      onChange={() => handlePermissionToggle('canViewAuditLogs')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div>
                      <div className="font-bold text-[#002B49]">سجلات التدقيق والأمان</div>
                      <div className="text-[10px] text-slate-500">متابعة كافة حركات النظام والمسؤولين</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canExportLogs}
                      onChange={() => handlePermissionToggle('canExportLogs')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div>
                      <div className="font-bold text-[#002B49]">تصدير التقارير</div>
                      <div className="text-[10px] text-slate-500">تنزيل تقارير الفحص بصيغة CSV و Excel</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white font-black cursor-pointer disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ وإضافة المسؤول</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT ADMIN MODAL */}
      {/* ========================================================================= */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-[#002B49]">
                تعديل بيانات وصلاحيات المسؤول ({editingAdmin.name})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديث الدور، الرقم السري، وتفعيل أو تعليق الصلاحيات
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#002B49] mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#002B49] mb-1">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-[#002B49] mb-1">
                    الرقم السري (PIN) *
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    maxLength={8}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono font-bold text-center tracking-wider"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#002B49] mb-1">تغيير كلمة المرور</label>
                  <input
                    type="password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="اتركه فارغاً للإبقاء"
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#002B49] mb-1">حالة الحساب</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-bold"
                  >
                    <option value="active">نشط (Active)</option>
                    <option value="suspended">معطل (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#002B49] mb-1">الدور الأساسي</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
                  className="w-full h-10 px-3 bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] font-bold text-[#002B49]"
                >
                  <option value="admin">مسؤول تدقيق (Admin)</option>
                  <option value="super_admin">مدير عام (Super Admin)</option>
                  <option value="viewer">مشاهد / مدقق سجلات (Viewer)</option>
                </select>
              </div>

              {/* Granular Permissions */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block font-bold text-[#002B49] mb-2">
                  توزيع الصلاحيات التفصيلية
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#F4F7F9] p-3 rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canUploadLists}
                      onChange={() => handlePermissionToggle('canUploadLists')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div className="font-bold text-[#002B49]">رفع ملفات وقوائم جديدة</div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canApproveLists}
                      onChange={() => handlePermissionToggle('canApproveLists')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div className="font-bold text-[#002B49]">اعتماد وتفعيل القوائم</div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canDeleteLists}
                      onChange={() => handlePermissionToggle('canDeleteLists')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div className="font-bold text-rose-700">حذف وأرشفة القوائم</div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canManageAdmins}
                      onChange={() => handlePermissionToggle('canManageAdmins')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div className="font-bold text-emerald-800">إدارة المشرفين والصلاحيات</div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canViewAuditLogs}
                      onChange={() => handlePermissionToggle('canViewAuditLogs')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div className="font-bold text-[#002B49]">سجلات التدقيق والأمان</div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-[#008269]">
                    <input
                      type="checkbox"
                      checked={permissions.canExportLogs}
                      onChange={() => handlePermissionToggle('canExportLogs')}
                      className="w-4 h-4 text-[#008269] rounded accent-[#008269]"
                    />
                    <div className="font-bold text-[#002B49]">تصدير التقارير</div>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white font-black cursor-pointer disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setDeletingAdmin(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-[#002B49]">
                تأكيد حذف حساب المشرف
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من رغبتك في حذف حساب المسؤول التالي نهائياً؟
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Target Admin Card */}
            <div className="bg-[#F4F7F9] p-4 rounded-2xl border border-slate-200 space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">اسم المسؤول:</span>
                <span className="text-xs font-black text-[#002B49]">{deletingAdmin.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">البريد الإلكتروني:</span>
                <span className="text-xs font-mono text-slate-700 dir-ltr">{deletingAdmin.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">الدور:</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  {deletingAdmin.role === 'super_admin' ? 'مدير عام' : 'مسؤول تدقيق'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                سيتم سحب جميع الصلاحيات فوراً وإلغاء الرقم السري ولن يتمكن هذا المستخدم من الدخول للنظام مرة أخرى.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md disabled:opacity-60"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
