import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Shield,
  Camera,
  Search,
  ArrowRight,
  X,
} from 'lucide-react';

const STEPS = [
  { icon: Sparkles, color: 'from-violet-500 to-fuchsia-500', key: 'aiSummary' },
  { icon: Shield, color: 'from-emerald-500 to-teal-500', key: 'healthCheck' },
  { icon: Camera, color: 'from-blue-500 to-cyan-500', key: 'snapshot' },
  { icon: Search, color: 'from-amber-500 to-orange-500', key: 'semanticSearch' },
] as const;

interface Props {
  onComplete: () => void;
}

export default function FeatureTour({ onComplete }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 sb-card rounded-2xl p-6 shadow-2xl relative">
        {/* Close */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 sb-muted hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${current.color} flex items-center justify-center mb-4 mx-auto`}>
          <Icon className="w-8 h-8 text-white" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-center mb-2">
          {t(`welcome.feature_${current.key}`)}
        </h3>
        <p className="text-sm sb-muted text-center mb-6">
          {t(`welcome.feature_${current.key}_desc`)}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-violet-500 w-6' : 'bg-[var(--bg-tertiary)]'
              }`}
            />
          ))}
        </div>

        {/* Action */}
        <button
          onClick={next}
          className="w-full py-3 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 transition-all flex items-center justify-center gap-2"
        >
          {step < STEPS.length - 1 ? (
            <>
              {t('welcome.getStarted')}
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            t('welcome.skipToManager')
          )}
        </button>
      </div>
    </div>
  );
}
