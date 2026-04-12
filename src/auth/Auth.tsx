import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { storageService } from '../services/storage';
import { authService, type AuthProvider } from '../services/auth';
import { applyTheme } from '../utils/theme';
import { useSettingsSync } from '../hooks/useSettingsSync';
import {
  Bookmark,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot-password';
type AuthStep = 'form' | 'verify-email' | 'reset-code' | 'success';

export default function Auth() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useSettingsSync();

  useEffect(() => {
    (async () => {
      const settings = await storageService.getSettings();
      if (settings.language && settings.language !== i18n.language) {
        i18n.changeLanguage(settings.language);
      }
      applyTheme(settings.theme);
    })();
  }, [i18n]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError(t('auth.passwordMismatch'));
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError(t('auth.passwordTooShort'));
          setLoading(false);
          return;
        }
        await authService.register({ email, password, name, referral: referralCode || undefined });
        setStep('verify-email');
      } else if (mode === 'login') {
        await authService.login({ email, password });
        setStep('success');
        setTimeout(() => {
          window.close();
        }, 1500);
      } else if (mode === 'forgot-password') {
        await authService.forgotPassword(email);
        setStep('reset-code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.verifyEmail({ email, code: verificationCode });
      // Fire-and-forget newsletter subscription after successful verification
      if (newsletterOptIn) {
        const settings = await storageService.getSettings();
        const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');
        fetch(`${baseUrl}/v1/public/newsletter/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, locale: i18n.language || 'en', source: 'registration' }),
        }).catch(() => {/* non-blocking */});
      }
      setStep('success');
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: AuthProvider) => {
    setError('');
    setLoading(true);

    try {
      await authService.oauthLogin(provider);
      setStep('success');
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);
    try {
      await authService.resendVerification(email);
      setSuccess(t('auth.codeSent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (newPassword.length < 8) {
        setError(t('auth.passwordTooShort'));
        setLoading(false);
        return;
      }
      await authService.resetPassword(email, resetCode, newPassword);
      setSuccess(t('auth.passwordResetSuccess'));
      setMode('login');
      setStep('form');
      setResetCode('');
      setNewPassword('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (step === 'success') {
    return (
      <div className="min-h-screen sb-page flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('auth.success')}</h1>
          <p className="sb-muted">{t('auth.redirecting')}</p>
        </div>
      </div>
    );
  }

  // Email verification screen
  if (step === 'verify-email') {
    return (
      <div className="min-h-screen sb-page flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('auth.verifyEmail')}</h1>
            <p className="sb-muted">{t('auth.verifyEmailDesc', { email })}</p>
          </div>

          {/* Verification Form */}
          <div className="sb-card p-6">
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.verificationCode')}</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="w-full sb-input px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full py-3 rounded-xl font-medium sb-button-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('auth.verify')}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  {t('auth.resendCode')}
                </button>
              </div>
            </form>
          </div>

          {/* Back button */}
          <button
            onClick={() => { setStep('form'); setMode('register'); }}
            className="mt-6 mx-auto flex items-center gap-2 text-sm sb-muted hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth.back')}
          </button>
        </div>
      </div>
    );
  }

  // Password reset code screen
  if (step === 'reset-code') {
    return (
      <div className="min-h-screen sb-page flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('auth.enterResetCode')}</h1>
            <p className="sb-muted">{t('auth.enterResetCodeDesc', { email })}</p>
          </div>

          {/* Reset Form */}
          <div className="sb-card p-6">
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.resetCode')}</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="000000"
                  className="w-full sb-input px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  maxLength={6}
                  required
                />
              </div>

              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.newPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 sb-muted" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    className="w-full sb-input pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || resetCode.length < 6}
                className="w-full py-3 rounded-xl font-medium sb-button-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('auth.resetPassword2')}
              </button>
            </form>
          </div>

          {/* Back button */}
          <button
            onClick={() => { setStep('form'); setMode('forgot-password'); }}
            className="mt-6 mx-auto flex items-center gap-2 text-sm sb-muted hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth.back')}
          </button>
        </div>
      </div>
    );
  }

  // Main auth form
  return (
    <div className="min-h-screen sb-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bookmark className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {mode === 'login' ? t('auth.signIn') : mode === 'register' ? t('auth.createAccount') : t('auth.resetPassword')}
          </h1>
          <p className="sb-muted">
            {mode === 'login' ? t('auth.signInDesc') : mode === 'register' ? t('auth.createAccountDesc') : t('auth.resetPasswordDesc')}
          </p>
        </div>

        {/* Auth Card */}
        <div className="sb-card p-6">
          {/* OAuth Buttons */}
          {mode !== 'forgot-password' && (
            <>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleOAuthLogin('google')}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl sb-card sb-card-hover flex items-center justify-center gap-3 font-medium transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('auth.continueWithGoogle')}
                </button>

                {/* Microsoft OAuth - hidden until configured */}
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t sb-divider"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 sb-page sb-muted">{t('auth.orContinueWith')}</span>
                </div>
              </div>
            </>
          )}

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.name')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 sb-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('auth.namePlaceholder')}
                    className="w-full sb-input pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm sb-muted mb-2">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 sb-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="w-full sb-input pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  required
                />
              </div>
            </div>

            {mode !== 'forgot-password' && (
              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 sb-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="w-full sb-input pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 sb-muted" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    className="w-full sb-input pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm sb-muted mb-2">{t('auth.referralCode')}</label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder={t('auth.referralCodePlaceholder')}
                  className="w-full sb-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-violet-500"
                />
                <span className="text-xs sb-muted leading-snug">
                  {i18n.language === 'zh' ? '订阅安全更新和诈骗提醒' : 'Subscribe to security updates and scam alerts'}
                </span>
              </label>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot-password'); setError(''); setSuccess(''); }}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium sb-button-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? t('auth.signIn') : mode === 'register' ? t('auth.createAccount') : t('auth.sendResetLink')}
            </button>
          </form>

          {/* Mode switcher */}
          <div className="mt-6 text-center text-sm">
            {mode === 'login' ? (
              <p className="sb-muted">
                {t('auth.noAccount')}{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  {t('auth.signUp')}
                </button>
              </p>
            ) : mode === 'register' ? (
              <p className="sb-muted">
                {t('auth.haveAccount')}{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  {t('auth.signIn')}
                </button>
              </p>
            ) : (
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="flex items-center gap-2 mx-auto text-violet-400 hover:text-violet-300"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('auth.backToSignIn')}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs sb-muted">
          <p>
            {t('auth.termsNotice')}
            <a href="https://scamlens.org/en/terms" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">{t('auth.termsLink')}</a>
            {t('auth.and')}
            <a href="https://scamlens.org/en/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">{t('auth.privacyLink')}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
