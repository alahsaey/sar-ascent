import React, { useState, useEffect } from 'react';
import { VerificationPage } from './components/public/VerificationPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { getCurrentAdminSession, logoutAdmin } from './services/auth';
import { initializeDatabase } from './services/db';
import { AdminUser } from './types';
import { BookOpen, X, Code2, Database, Shield, FileSpreadsheet, Network } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'public' | 'admin'>('public');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isArchDocOpen, setIsArchDocOpen] = useState(false);

  useEffect(() => {
    // Initialize seed data
    initializeDatabase().catch(err => console.error('Database initialization error:', err));

    // Restore existing admin session
    const session = getCurrentAdminSession();
    if (session) {
      setCurrentAdmin(session.user);
    }
  }, []);

  const handleLoginSuccess = (user: AdminUser) => {
    setCurrentAdmin(user);
    setView('admin');
  };

  const handleLogout = () => {
    logoutAdmin();
    setCurrentAdmin(null);
    setView('public');
  };

  return (
    <div className="min-h-screen font-sans antialiased text-slate-800 selection:bg-emerald-200 selection:text-emerald-900" dir="rtl">
      {/* Floating System Specs & Docs Badge */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          id="btn-open-arch-docs"
          onClick={() => setIsArchDocOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-semibold backdrop-blur-md shadow-lg border border-slate-700/80 transition-all hover:scale-105 cursor-pointer"
          title="عرض وثيقة المعمارية وقاعدة البيانات ومواصفات API"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>وثيقة المعمارية والـ API (البند 25)</span>
        </button>
      </div>

      {/* Main View Router */}
      {view === 'admin' && currentAdmin ? (
        <AdminLayout
          currentAdmin={currentAdmin}
          onLogout={handleLogout}
          onGoToPublicPortal={() => setView('public')}
        />
      ) : (
        <VerificationPage
          onOpenAdminLogin={() => setIsLoginModalOpen(true)}
          isAdminLoggedIn={!!currentAdmin}
          onGoToDashboard={() => setView('admin')}
        />
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Architecture, Schema & System Design Specification Modal (Requested in #25) */}
      {isArchDocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    وثيقة معمارية النظام ومواصفات الأمان وقاعدة البيانات
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    توثيق كامل للـ Architecture, Schema, ERD, API, Flows وفق البند 25 من المتطلبات
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsArchDocOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-5 space-y-6 text-xs text-slate-700 leading-relaxed">
              {/* 1. Architecture Diagram */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-700" />
                  <span>1. معمارية النظام (System Architecture)</span>
                </h4>
                <div className="bg-slate-900 text-emerald-300 p-4 rounded-lg font-mono text-[11px] leading-normal dir-ltr text-left overflow-x-auto">
                  {`[Public Mobile / Web User] 
        │ (Enters employee_number ONLY)
        ▼
[Public Verification UI] ──▶ [Validation & Normalization (Regex, Trim, Eastern Digits)]
                                 │
                                 ▼
                         [Indexed Database Query] (Indexed on employee_number + activeList.id)
                                 │
                                 ├──▶ [Match Found]     ──▶ Return Authorized Card (Light Green ✓)
                                 └──▶ [Match Not Found] ──▶ Return Not Authorized Card (Light Red ✕)
                                 │
                                 ▼
                       [Async Audit & Verification Logging Engine]

[Admin / Super Admin] ──▶ [Secure Auth Layer (Argon2 / SHA-256 + Salt)]
                                 │
                                 ▼
                         [Admin Control Panel]
                                 ├──▶ [Excel/CSV Stream Processing Pipeline (ExcelJS / SheetJS)]
                                 │       ├── Preserve Leading Zeros (as String)
                                 │       ├── Autodetect Columns
                                 │       └── Deduplication & Empty Row Purge
                                 ├──▶ [Multi-Version List Management: Active / Archived / Approved]
                                 ├──▶ [Audit & Verification Logs with Date/Result Filtering]
                                 └──▶ [Role-Based Access Control: Super Admin vs Admin]`}
                </div>
              </section>

              {/* 2. Database Schema & ERD */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-700" />
                  <span>2. مخطط قاعدة البيانات والعلاقات (Database Schema & ERD)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="font-bold text-emerald-900 mb-1">employee_lists (القوائم)</div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-slate-600 dir-ltr text-left">
                      <li>id (PK, string)</li>
                      <li>file_name (string)</li>
                      <li>file_type ('xlsx' | 'csv')</li>
                      <li>version_number (number, auto-increment)</li>
                      <li>total_records (number)</li>
                      <li>status ('uploaded'|'validated'|'approved'|'active'|'archived')</li>
                      <li>uploaded_by (string)</li>
                      <li>uploaded_at (timestamp)</li>
                      <li>approved_by (string)</li>
                      <li>approved_at (timestamp)</li>
                    </ul>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="font-bold text-emerald-900 mb-1">employees (الموظفون المصرح لهم)</div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-slate-600 dir-ltr text-left">
                      <li>id (PK, string)</li>
                      <li>employee_number (Indexed, String - يحفظ الأصفار البادئة)</li>
                      <li>list_id (FK - references employee_lists.id)</li>
                      <li>created_at (timestamp)</li>
                    </ul>
                    <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
                      * مفهرس بالكامل ومحمي دون كشف أي أسماء أو هويات أو قطاعات.
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="font-bold text-emerald-900 mb-1">verification_logs (سجل الاستعلامات)</div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-slate-600 dir-ltr text-left">
                      <li>id (PK, string)</li>
                      <li>employee_number (string)</li>
                      <li>result ('AUTHORIZED' | 'NOT_AUTHORIZED')</li>
                      <li>list_id (FK)</li>
                      <li>checked_at (timestamp)</li>
                      <li>ip_address (string)</li>
                      <li>user_agent (string)</li>
                    </ul>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="font-bold text-emerald-900 mb-1">audit_logs & admins (التدقيق والإشراف)</div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-slate-600 dir-ltr text-left">
                      <li>admins: id, name, email, password_hash, role</li>
                      <li>audit_logs: id, admin_id, action, entity_type, created_at</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* 3. API Specification */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-700" />
                  <span>3. مواصفات واجهة البرمجة (API Specification: POST /api/verify)</span>
                </h4>
                <div className="space-y-2">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] dir-ltr text-left">
                    <div className="text-slate-500 font-bold mb-1">// Request:</div>
                    <div className="text-blue-700">POST /api/verify</div>
                    <div className="text-slate-600">Content-Type: application/json</div>
                    <pre className="text-slate-800 bg-slate-50 p-2 rounded mt-1">
{`{
  "employee_number": "001234"
}`}
                    </pre>

                    <div className="text-slate-500 font-bold mt-3 mb-1">// Response (If Found):</div>
                    <pre className="text-emerald-800 bg-emerald-50 p-2 rounded">
{`{
  "authorized": true,
  "message": "مصرح له بالسفر",
  "last_updated": "2026-09-17T07:30:00"
}`}
                    </pre>

                    <div className="text-slate-500 font-bold mt-3 mb-1">// Response (If Not Found):</div>
                    <pre className="text-rose-800 bg-rose-50 p-2 rounded">
{`{
  "authorized": false,
  "message": "غير مصرح له بالسفر",
  "last_updated": "2026-09-17T07:30:00"
}`}
                    </pre>
                  </div>
                </div>
              </section>

              {/* 4. Security & Privacy Plan */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <span>4. خطة الأمان وحماية خصوصية البيانات (Security Plan)</span>
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600">
                  <li><strong>عدم كشف البيانات الشخصية:</strong> النظام مصمم هندسياً بألا يسترجع أو يعرض الاسم، الهوية، أو القسم، بل يقتصر على تأكيد صلاحية السفر وتاريخ آخر تحديث فقط.</li>
                  <li><strong>معاملة الأرقام كنص نقي (String):</strong> الحفاظ التام على الأصفار في بداية الرقم الوظيفي (مثل 001234) ومنع تحويلها لأرقام حسابية.</li>
                  <li><strong>صلاحيات القوائم:</strong> القائمة السابقة تصبح مؤرشفة (Archived) فور اعتماد قائمة جديدة، والبحث يتم حصرياً في أحدث قائمة معتمدة ونشطة.</li>
                  <li><strong>حماية لوحة الإدارة:</strong> عزل لوحة الإدارة وتوثيق كل إجراء إداري في سجل تدقيق غير قابل للتعديل (Audit Log).</li>
                </ul>
              </section>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsArchDocOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                إغلاق الوثيقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
