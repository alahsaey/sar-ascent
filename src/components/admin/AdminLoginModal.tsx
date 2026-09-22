import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  TrainTrack,
  ShieldCheck,
  Eye,
  EyeOff,
  Hash
} from 'lucide-react';
import { loginAdmin, loginWithPinOnly } from '../../services/auth';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

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
      const user = await loginWithPinOnly(pinCode);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'الرقم السري غير مصرح له بالدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Top SAR Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#002B49] via-[#008269] to-[#D0A85C]" />

        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5 pt-2">
          <div className="inline-flex items-center justify-center mb-3">
            <SarLogo variant="horizontal" theme="dark" size="md" />
          </div>
          <h3 className="text-xl font-black text-[#002B49] mt-2">
            تسجيل دخول لوحة التحكم
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            منطقة مشفرة ومخصصة لمسؤولي ومراجعي تصاريح السفر فقط
          </p>
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
            <span>الدخول بالرقم السري (PIN)</span>
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

        {/* PIN LOGIN FORM */}
        {loginMode === 'pin' ? (
          <form onSubmit={handleSubmitPin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#002B49]">
                  الرقم السري للمسؤول (PIN Code)
                </label>
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
                  maxLength={10}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="أدخل الرقم السري المعتمد"
                  className="w-full h-12 px-4 pr-11 text-center text-lg tracking-widest font-mono bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269] transition-all"
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-right">
                🔒 يتم التحقق فوريًا من صلاحيات المشرفين المعتمدين والمخولين من قبل إدارة النظام فقط.
              </p>
            </div>

            <button
              id="btn-submit-pin-login"
              type="submit"
              disabled={loading || !pinCode.trim()}
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
        ) : (
          /* CREDENTIALS LOGIN FORM */
          <form onSubmit={handleSubmitCredentials} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#002B49] mb-1.5">
                البريد الإلكتروني الرسمي
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sar.com.sa"
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
              disabled={loading || !email.trim() || !password.trim()}
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
