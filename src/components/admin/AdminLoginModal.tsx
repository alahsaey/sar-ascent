import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  ShieldAlert,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Hash,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import {
  loginAdmin,
  loginWithPinOnly,
  loginAdminWithGoogle,
  formatAdminDisplayName
} from '../../services/auth';
import { getAdminUsers } from '../../services/db';
import { AdminUser } from '../../types';
import { SarLogo } from '../SarLogo';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [loginMode, setLoginMode] = useState<'pin' | 'credentials'>('pin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [availableAdmins, setAvailableAdmins] = useState<AdminUser[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Load registered active admins list for fast selection
  useEffect(() => {
    if (isOpen) {
      getAdminUsers()
        .then(users => {
          setAvailableAdmins(users);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const user = await loginAdminWithGoogle();
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول عبر حساب Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await loginAdmin(email, password, 'password');
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'بيانات الاعتماد غير مصرح لها بالوصول.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Pass the selected admin ID or email to distinguish between multiple admins
      const user = await loginWithPinOnly(pinCode, selectedAdminId || undefined);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'الرمز السري غير مصرح له بالدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#008269] via-[#002B49] to-[#D4A843]" />

        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-5 left-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center mb-2">
            <SarLogo variant="horizontal" theme="dark" size="md" />
          </div>
          <h3 className="text-xl font-black text-[#002B49] mt-2">
            تسجيل دخول لوحة التحكم
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            منطقة مشفرة ومخصصة لمسؤولي ومراجعي تصاريح السفر فقط
          </p>
        </div>

        {/* 1. GOOGLE DIRECT AUTHENTICATION FOR ADMINS */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full h-12 px-4 rounded-2xl bg-white border border-slate-300 hover:border-[#008269] hover:bg-emerald-50/30 text-slate-800 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-3 shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50 group"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-[#008269]/30 border-t-[#008269] rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>الدخول المباشر بحساب Google للمسؤول</span>
          </button>
          <div className="flex items-center justify-between px-2 mt-1.5">
            <span className="text-[10px] text-slate-500">
              الدخول بضغطة زر دون الحاجة للرمز السري
            </span>
            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
              المشرف العام (المالك)
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="relative flex py-2 items-center mb-3">
          <div className="flex-grow border-t border-slate-200" />
          <span className="shrink-0 mx-3 text-[11px] font-bold text-slate-400">
            أو الدخول بالرمز السري / كلمة المرور
          </span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        {/* Login Mode Switcher */}
        <div className="flex bg-[#F4F7F9] p-1 rounded-2xl border border-slate-200 mb-5">
          <button
            type="button"
            onClick={() => {
              setLoginMode('pin');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'pin'
                ? 'bg-[#008269] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>الرمز السري (أرقام / حروف)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('credentials');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginMode === 'credentials'
                ? 'bg-[#008269] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>البريد وكلمة المرور</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="leading-relaxed font-semibold">{error}</div>
          </div>
        )}

        {/* 2. PIN / ALPHANUMERIC CODE LOGIN FORM WITH USER IDENTIFICATION */}
        {loginMode === 'pin' && (
          <form onSubmit={handleSubmitPin} className="space-y-4">
            {/* Admin Selector to distinguish between users on the same machine */}
            <div>
              <label className="block text-xs font-bold text-[#002B49] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#008269]" />
                  <span>تحديد حساب المسؤول</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  لتمييز حسابك عن المشرفين الآخرين
                </span>
              </label>

              <div className="relative">
                <select
                  value={selectedAdminId}
                  onChange={(e) => {
                    setSelectedAdminId(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-11 px-3.5 pl-9 text-xs sm:text-sm font-bold bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] appearance-none transition-all cursor-pointer text-slate-800 font-mono"
                >
                  <option value="">-- كشف تلقائي بالرمز السري أو اختر الحساب --</option>
                  {availableAdmins.map((adm) => (
                    <option key={adm.id} value={adm.id}>
                      {formatAdminDisplayName(adm.name)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <label className="block text-xs font-bold text-[#002B49]">
                    الرمز أو الرقم السري للمسؤول
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    أرقام وحروف
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[11px] font-bold text-[#008269] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPin ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  autoFocus
                  dir="ltr"
                  maxLength={32}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="أدخل الرمز السري الخاص بك"
                  className="w-full h-12 px-4 pr-11 text-center text-base sm:text-lg tracking-wider font-mono bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] transition-all"
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>🔒</span>
                  <span>التحقق مشفر بالخزنة الرقمية المقاومة للتخمين</span>
                </span>
                <span className="text-slate-400 font-mono text-[9px]">SHA-256 + Salt</span>
              </p>
            </div>

            <button
              id="btn-submit-pin-login"
              type="submit"
              disabled={loading || !pinCode.trim() || googleLoading}
              className="w-full h-12 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-sm font-black transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>التحقق والدخول المباشر</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. CREDENTIALS LOGIN FORM */}
        {loginMode === 'credentials' && (
          <form onSubmit={handleSubmitCredentials} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#002B49] mb-1.5">
                البريد الإلكتروني الرسمي أو اسم المشرف
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="البريد الإلكتروني أو اسم الحساب"
                  className="w-full h-11 px-3.5 pr-10 text-sm bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] transition-all font-mono"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#002B49]">
                  كلمة المرور أو الرقم السري
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-bold text-[#008269] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 pr-10 text-sm bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] transition-all font-mono"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              id="btn-submit-admin-login"
              type="submit"
              disabled={loading || !email.trim() || !password.trim() || googleLoading}
              className="w-full h-12 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-sm font-black transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>دخول لوحة التحكم</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
