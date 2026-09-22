import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Lock,
  Calendar,
  AlertTriangle,
  RotateCcw,
  TrainTrack,
  UserCheck,
  HelpCircle,
  CheckCheck,
  Building2,
  Sparkles,
  MapPin,
  Clock,
  Timer
} from 'lucide-react';
import { verifyEmployeeTravel, getActiveEmployeeList, subscribeToEmployeeLists } from '../../services/db';
import { VerificationResult, EmployeeList } from '../../types';
import { formatArabicDateTime, formatArabicDateTimeWithSeconds } from '../../utils/date';
import { SarLogo } from '../SarLogo';

interface VerificationPageProps {
  onOpenAdminLogin: () => void;
  isAdminLoggedIn: boolean;
  onGoToDashboard: () => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  onOpenAdminLogin,
  isAdminLoggedIn,
  onGoToDashboard,
}) => {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<EmployeeList | null>(null);
  const [checkedAtFormatted, setCheckedAtFormatted] = useState<string>('');
  const [inquiryTimestampFormatted, setInquiryTimestampFormatted] = useState<string>('');
  const [currentLiveTime, setCurrentLiveTime] = useState<string>('');

  useEffect(() => {
    // Live Clock Ticker
    const updateTime = () => {
      setCurrentLiveTime(formatArabicDateTimeWithSeconds(new Date()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const refreshActiveList = () => {
      getActiveEmployeeList().then(list => {
        setActiveList(list);
      }).catch(() => {});
    };
    
    refreshActiveList();

    // 1. Real-time Firestore lists subscription
    const unsubLists = subscribeToEmployeeLists((lists) => {
      const active = lists.find(l => l.status === 'active') || null;
      setActiveList(active);
    });

    // 2. Storage & Broadcast sync for same-browser windows
    const handleSync = () => {
      refreshActiveList();
    };

    window.addEventListener('sar-storage-changed', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      clearInterval(interval);
      unsubLists();
      window.removeEventListener('sar-storage-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setResult(null);

    const trimmed = employeeNumber.trim();

    if (!trimmed) {
      setErrorMessage('يرجى إدخال الرقم الوظيفي.');
      return;
    }

    if (trimmed.length < 2 || trimmed.length > 25) {
      setErrorMessage('يرجى التأكد من صحة الرقم الوظيفي وإعادة المحاولة.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyEmployeeTravel(trimmed);
      const inquiryMoment = res.checkedAt || new Date().toISOString();
      setResult(res);
      setCheckedAtFormatted(formatArabicDateTime(res.lastUpdated));
      setInquiryTimestampFormatted(formatArabicDateTimeWithSeconds(inquiryMoment));
    } catch (err: any) {
      if (err.message === 'NO_ACTIVE_LIST') {
        setErrorMessage('لا توجد قائمة معتمدة حالياً. يرجى التواصل مع إدارة الموارد البشرية والابتعاث بشركة سار.');
      } else if (err.message === 'EMPTY_INPUT') {
        setErrorMessage('يرجى إدخال الرقم الوظيفي.');
      } else {
        setErrorMessage('تعذر تنفيذ عملية التحقق حالياً. يرجى المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmployeeNumber('');
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F9] text-[#002B49] selection:bg-[#008269]/20 selection:text-[#008269] font-sar">
      {/* SAR Official Brand Header */}
      <header className="w-full bg-[#002B49] text-white border-b-4 border-[#008269] sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Official SAR Logo Lockup */}
            <SarLogo variant="horizontal" theme="white" size="sm" />
            
            <div className="hidden sm:block h-6 w-px bg-white/20" />

            <div className="hidden sm:block">
              <div className="text-[10.5px] font-bold text-[#D0A85C] tracking-wide">
                بوابة الخدمات الإلكترونية
              </div>
              <div className="text-xs font-black text-white">
                نظام أوامر إركاب الموظفين
              </div>
            </div>
          </div>

          <div>
            {isAdminLoggedIn ? (
              <button
                id="btn-goto-dashboard"
                onClick={onGoToDashboard}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#008269] text-white text-xs sm:text-sm font-bold hover:bg-[#006B56] active:scale-[0.99] transition-all shadow-xs cursor-pointer border border-[#00A383]/30"
              >
                <ShieldCheck className="w-4 h-4 text-[#C3EFE5]" />
                <span>لوحة التحكم</span>
              </button>
            ) : (
              <button
                id="btn-admin-login"
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-colors cursor-pointer"
                title="تسجيل دخول مسؤولي النظام"
              >
                <Lock className="w-3.5 h-3.5 text-[#D0A85C]" />
                <span>دخول الإدارة</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
        <div className="w-full max-w-[480px]">
          
          {/* Main Card */}
          <div className="bg-white rounded-3xl sar-card-shadow border border-slate-200/80 p-5 sm:p-7 relative overflow-hidden">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#002B49] via-[#008269] to-[#D0A85C]" />

            {/* Logo Emblem & Heading */}
            <div className="text-center mb-4 sm:mb-5 pt-1">
              <div className="inline-flex items-center justify-center mb-3.5">
                <SarLogo variant="horizontal" theme="dark" size="lg" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#002B49] mb-1.5 tracking-tight">
                خدمة التحقق من أمر إركاب الموظفين
              </h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed mb-3">
                أدخل الرقم الوظيفي للتحقق الفوري من صلاحية ومطابقة أمر الإركاب وفق القوائم المعتمدة لدى الشركة السعودية للخطوط الحديدية (سار).
              </p>

              {/* Current Live Time Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/80 text-[11px] text-slate-600 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>توقيت التحقق المباشر:</span>
                <span className="font-mono font-bold text-[#002B49] dir-ltr">{currentLiveTime || 'جاري المزامنة...'}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label
                  htmlFor="employee-number-input"
                  className="block text-xs sm:text-sm font-bold text-[#002B49] mb-2"
                >
                  الرقم الوظيفي للموظف
                </label>
                <div className="relative">
                  <input
                    id="employee-number-input"
                    type="text"
                    inputMode="text"
                    dir="ltr"
                    autoFocus
                    value={employeeNumber}
                    onChange={(e) => {
                      setEmployeeNumber(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="مثال: 001234 أو 104820"
                    className="w-full h-14 px-4 text-center sm:text-right font-mono text-lg font-black tracking-wider bg-[#F4F7F9] border-2 border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#008269]/15 focus:border-[#008269] transition-all text-[#002B49] placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm"
                  />
                  {employeeNumber && (
                    <button
                      type="button"
                      onClick={() => setEmployeeNumber('')}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title="مسح الرقم"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <button
                id="btn-verify-submit"
                type="submit"
                disabled={loading}
                className="w-full h-13 rounded-2xl bg-[#008269] hover:bg-[#006B56] active:scale-[0.99] text-white font-black text-base flex items-center justify-center gap-2.5 transition-all shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border border-[#00A383]/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>تحقق من أمر الإركاب</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {errorMessage && (
              <div
                id="verification-error-banner"
                role="alert"
                className="mt-6 p-4 rounded-2xl bg-[#FEF3F2] border border-[#FDA29B] text-[#800A1D] text-xs sm:text-sm flex items-start gap-3 animate-in fade-in duration-200"
              >
                <AlertTriangle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
                <div className="font-bold leading-relaxed">
                  {errorMessage}
                </div>
              </div>
            )}

            {/* RESULTS DISPLAY */}
            {result && (
              <div className="mt-8 animate-in zoom-in-95 duration-200">
                {result.authorized ? (
                  /* 🟩 CASE 1: AUTHORIZED CARD (SAR Official Emerald Green Theme) */
                  <div
                    id="result-authorized-card"
                    className="bg-[#E8F8F4] border-2 border-[#008269] rounded-2xl p-6 sm:p-8 text-center shadow-xs"
                  >
                    {/* Big Distinct Checkmark Icon with Emerald Ring */}
                    <div className="w-18 h-18 mx-auto rounded-full bg-[#008269] border-4 border-[#C3EFE5] flex items-center justify-center text-white mb-4 shadow-sm">
                      <CheckCircle2 className="w-10 h-10" strokeWidth={2.8} />
                    </div>

                    {/* Main Text */}
                    <h3 className="text-2xl sm:text-3xl font-black text-[#005443] mb-1.5 tracking-tight">
                      مصرح له الصعود بأمر إركاب
                    </h3>

                    {/* Subtext */}
                    <p className="text-xs sm:text-sm font-bold text-[#006B56] mb-5 max-w-sm mx-auto leading-relaxed">
                      تم العثور على الرقم الوظيفي ومطابقته في قائمة المصرح لهم بالصعود بأمر إركاب المعتمدة لدى سار.
                    </p>

                    {/* Prominent Employee Details Box */}
                    <div className="bg-white border border-[#8EDECB] rounded-2xl p-4 sm:p-5 mb-4 shadow-2xs text-right space-y-3.5">
                      {/* Name */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-[#E8F8F4] pb-3">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold">
                          <UserCheck className="w-4 h-4 text-[#008269] shrink-0" />
                          <span>اسم الموظف / السائق:</span>
                        </div>
                        <span className="text-base sm:text-lg font-black text-[#002B49]">
                          {result.employeeName || 'موظف معتمد في القائمة'}
                        </span>
                      </div>
                      
                      {/* Employee Number */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#E8F8F4] pb-3">
                        <span className="text-xs font-bold text-slate-600">الرقم الوظيفي (ID):</span>
                        <span className="font-mono font-black text-sm text-[#008269] dir-ltr bg-[#E8F8F4] px-3 py-1 rounded-lg border border-[#8EDECB]">
                          {result.employeeNumber}
                        </span>
                      </div>

                      {/* Allowed Travel Destination / Route */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold">
                          <MapPin className="w-4 h-4 text-[#B28B3E] shrink-0" />
                          <span>جهة ومسار السفر المسموح:</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 bg-[#FAF5EB] text-[#7E5B27] font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-[#EBD5A0]">
                          <TrainTrack className="w-4 h-4 text-[#7E5B27] shrink-0" />
                          <span>{result.allowedRoute || 'كافة خطوط ومسارات شبكة سار'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Live Query Moment Card - Exact Timestamp with seconds */}
                    <div className="bg-white/90 border border-[#8EDECB] rounded-2xl p-3.5 mb-4 shadow-2xs text-right space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#005443]">
                          <Clock className="w-4 h-4 text-[#008269] shrink-0" />
                          <span>تاريخ ووقت الاستعلام اللحظي:</span>
                        </div>
                        <span className="font-mono font-black text-xs sm:text-sm text-[#008269] bg-[#E8F8F4] px-2.5 py-1 rounded-lg border border-[#8EDECB] dir-ltr text-center">
                          {inquiryTimestampFormatted}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E8F8F4] text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1 font-medium">
                          <CheckCheck className="w-3.5 h-3.5 text-[#008269]" />
                          <span>حالة التدقيق:</span>
                        </span>
                        <span className="font-bold text-[#005443]">بيانات رسمية لحظية معتمدة من سار</span>
                      </div>
                    </div>

                    {/* Subtle divider */}
                    <div className="w-24 h-px bg-[#008269]/25 mx-auto mb-3" />

                    {/* Footer - Date of Latest Approved List */}
                    <div className="text-xs font-medium text-[#005443] flex flex-col items-center justify-center gap-1">
                      <span className="text-slate-600 font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>تاريخ اعتماد القائمة الحالية:</span>
                      </span>
                      <span className="font-bold text-[#002B49] text-xs font-mono dir-ltr">
                        {checkedAtFormatted}
                      </span>
                    </div>

                    {/* Action to check another */}
                    <div className="mt-5 pt-4 border-t border-[#008269]/20">
                      <button
                        onClick={handleReset}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008269] hover:text-[#005443] underline underline-offset-4 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>التحقق من رقم وظيفي آخر</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 🟥 CASE 2: NOT AUTHORIZED CARD (SAR Alert Theme) */
                  <div
                    id="result-not-authorized-card"
                    className="bg-[#FEF3F2] border-2 border-[#FDA29B] rounded-2xl p-6 sm:p-8 text-center shadow-xs"
                  >
                    {/* Big Distinct X Icon */}
                    <div className="w-18 h-18 mx-auto rounded-full bg-[#C8102E] border-4 border-[#FEE4E2] flex items-center justify-center text-white mb-4 shadow-sm">
                      <XCircle className="w-10 h-10" strokeWidth={2.8} />
                    </div>

                    {/* Main Text */}
                    <h3 className="text-2xl sm:text-3xl font-black text-[#5F0715] mb-1.5 tracking-tight">
                      ليس لديه أمر إركاب موظف
                    </h3>

                    {/* Subtext */}
                    <p className="text-xs sm:text-sm font-bold text-[#800A1D] mb-5 max-w-sm mx-auto leading-relaxed">
                      لم يتم العثور على الرقم الوظيفي في القائمة المعتمدة؛ ليس لديه أمر إركاب موظف حالياً.
                    </p>

                    {/* Employee Number Box */}
                    <div className="bg-white border border-[#FECDCA] rounded-xl p-3.5 mb-4 shadow-2xs text-right">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">الرقم الوظيفي المدخل:</span>
                        <span className="font-mono font-black text-sm text-[#C8102E] dir-ltr bg-[#FEF3F2] px-3 py-1 rounded-md border border-[#FDA29B]">
                          {result.employeeNumber}
                        </span>
                      </div>
                    </div>

                    {/* Live Query Moment Card for Unauthorized */}
                    <div className="bg-white/90 border border-[#FECDCA] rounded-2xl p-3.5 mb-4 shadow-2xs text-right space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#800A1D]">
                          <Clock className="w-4 h-4 text-[#C8102E] shrink-0" />
                          <span>تاريخ ووقت الاستعلام اللحظي:</span>
                        </div>
                        <span className="font-mono font-black text-xs sm:text-sm text-[#C8102E] bg-[#FEF3F2] px-2.5 py-1 rounded-lg border border-[#FDA29B] dir-ltr text-center">
                          {inquiryTimestampFormatted}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#FEF3F2] text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#C8102E]" />
                          <span>حالة التدقيق:</span>
                        </span>
                        <span className="font-bold text-[#800A1D]">استعلام لحظي - غير مصرح</span>
                      </div>
                    </div>

                    {/* Subtle divider */}
                    <div className="w-24 h-px bg-[#FDA29B]/60 mx-auto mb-3" />

                    {/* Footer - Date of Latest Approved List */}
                    <div className="text-xs font-medium text-slate-600 flex flex-col items-center justify-center gap-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>تاريخ اعتماد القائمة الحالية:</span>
                      </span>
                      <span className="font-bold text-[#002B49] text-xs font-mono dir-ltr">
                        {checkedAtFormatted}
                      </span>
                    </div>

                    {/* Action to check another */}
                    <div className="mt-5 pt-4 border-t border-[#FECDCA]">
                      <button
                        onClick={handleReset}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C8102E] hover:text-[#800A1D] underline underline-offset-4 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة المحاولة برقم آخر</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enterprise Security Shield & Firewall Indicator */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <span className="font-bold text-[#002B49] block">جدار الحماية الأمني الفوري (WAF Shield)</span>
                    <span className="text-[11px] text-slate-500">مشفر ومحمي ضد التطفل والاستعلام العشوائي • TLS 1.3 / AES-256</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#008269] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>محمي بالكامل</span>
                </div>
              </div>
            </div>

          </div>

          {/* Privacy and Security Guarantee Badge */}
          <div className="mt-6 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#008269]" />
            <span>نظام محمي ومعتمد لدى الشركة السعودية للخطوط الحديدية (سار)</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>الشركة السعودية للخطوط الحديدية (سار) © {new Date().getFullYear()}</span>
          {activeList && (
            <span className="text-slate-500">
              القائمة المعتمدة: <strong className="text-[#002B49] font-bold">{activeList.title}</strong> (تحديث {formatArabicDateTime(activeList.approvedAt || activeList.uploadedAt)})
            </span>
          )}
        </div>
      </footer>
    </div>
  );
};
