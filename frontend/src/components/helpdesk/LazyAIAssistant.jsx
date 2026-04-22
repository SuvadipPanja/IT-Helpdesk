import { Suspense, lazy, useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/AIAssistantLauncher.css';

const AIAssistant = lazy(() => import('./AIAssistant'));

const LazyAIAssistant = () => {
  const { licenseState, hasLicensedFeature } = useAuth();
  const [shouldLoad, setShouldLoad] = useState(false);

  const assistantLicensed = !licenseState?.loaded || hasLicensedFeature('ai_assistant');

  if (!assistantLicensed) {
    return null;
  }

  if (!shouldLoad) {
    return (
      <button
        type="button"
        className="nbot-launcher"
        onClick={() => setShouldLoad(true)}
        aria-label="Open IT support assistant"
        title="Open IT support assistant"
      >
        <span className="nbot-launcher__icon">
          <Sparkles size={22} />
        </span>
        <span className="nbot-launcher__pulse" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Suspense
      fallback={
        <button
          type="button"
          className="nbot-launcher"
          disabled
          aria-label="Loading IT support assistant"
          title="Loading IT support assistant"
        >
          <span className="nbot-launcher__icon">
            <LoaderCircle size={22} className="nbot-launcher__spinner" />
          </span>
        </button>
      }
    >
      <AIAssistant initialOpen />
    </Suspense>
  );
};

export default LazyAIAssistant;