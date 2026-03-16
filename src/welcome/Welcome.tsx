import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { storageService } from '../services/storage';
import { applyTheme } from '../utils/theme';
import {
  Sparkles,
  Shield,
  Camera,
  Search,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

const FEATURES = [
  { icon: Sparkles, color: 'text-violet-400 bg-violet-500/20', key: 'aiSummary' },
  { icon: Shield, color: 'text-emerald-400 bg-emerald-500/20', key: 'healthCheck' },
  { icon: Camera, color: 'text-blue-400 bg-blue-500/20', key: 'snapshot' },
  { icon: Search, color: 'text-amber-400 bg-amber-500/20', key: 'semanticSearch' },
] as const;

export default function Welcome() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    (async () => {
      const settings = await storageService.getSettings();
      applyTheme(settings.theme);
    })();
  }, []);

  function openManager() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/index.html') });
    window.close();
  }

  function openAuth() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/auth/index.html') });
  }

  return (
    <div className="min-h-screen sb-page flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        {step === 0 && (
          <div className="space-y-8 animate-fadeIn">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-violet-500/30">
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold mb-3">
                {t('welcome.title')}
              </h1>
              <p className="sb-muted text-lg">
                {t('welcome.subtitle')}
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-2 gap-4 text-left">
              {FEATURES.map(({ icon: Icon, color, key }) => (
                <div key={key} className="sb-card p-4 rounded-xl">
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-medium text-sm mb-1">{t(`welcome.feature_${key}`)}</h3>
                  <p className="text-xs sb-muted">{t(`welcome.feature_${key}_desc`)}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-xl font-semibold text-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 transition-all flex items-center justify-center gap-2"
            >
              {t('welcome.getStarted')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">{t('welcome.readyTitle')}</h2>
              <p className="sb-muted">{t('welcome.readyDesc')}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={openAuth}
                className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 transition-all"
              >
                {t('welcome.signUpFree')}
              </button>
              <button
                onClick={openManager}
                className="w-full py-3 rounded-xl font-medium sb-card sb-card-hover transition-all"
              >
                {t('welcome.skipToManager')}
              </button>
            </div>

            <p className="text-xs sb-muted">
              {t('welcome.tipShortcut')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
