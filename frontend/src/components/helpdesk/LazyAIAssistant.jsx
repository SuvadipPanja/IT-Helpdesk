import { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import settingsLoader from '../../utils/settingsLoader';
import '../../styles/AIAssistantLauncher.css';

const AIAssistant = lazy(() => import('./AIAssistant'));

/** Resolve a bot_icon_url (relative /uploads path or absolute URL) to a full URL. */
function resolveBotIconUrl(raw) {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/uploads')) {
    const base = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || '';
    return `${base}${raw}`;
  }
  return raw;
}

const LazyAIAssistant = () => {
  const { licenseState, hasLicensedFeature } = useAuth();
  const [shouldLoad, setShouldLoad] = useState(false);

  // Read bot_icon_url immediately — settings are guaranteed loaded before Layout renders (App.jsx awaits loadSettings).
  // Also react to live settings-updated events (e.g. admin changes icon while user is logged in).
  const [botIconRaw, setBotIconRaw] = useState(() => settingsLoader.getSetting('bot_icon_url', ''));

  useEffect(() => {
    const onSettingsUpdated = (e) => {
      const updated = e.detail?.bot_icon_url ?? settingsLoader.getSetting('bot_icon_url', '');
      setBotIconRaw(updated);
    };
    window.addEventListener('settings-updated', onSettingsUpdated);
    // Re-read in case settings loaded after our lazy init (edge case)
    setBotIconRaw(settingsLoader.getSetting('bot_icon_url', ''));
    return () => window.removeEventListener('settings-updated', onSettingsUpdated);
  }, []);

  const botIconSrc = useMemo(() => resolveBotIconUrl(botIconRaw), [botIconRaw]);
  const [iconError, setIconError] = useState(false);
  const showCustomIcon = botIconSrc && !iconError;

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
          {showCustomIcon ? (
            <img
              src={botIconSrc}
              alt="Bot"
              className="nbot-launcher__bot-icon"
              onError={() => setIconError(true)}
            />
          ) : (
            <Sparkles size={22} />
          )}
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
            {showCustomIcon ? (
              <img
                src={botIconSrc}
                alt="Bot"
                className="nbot-launcher__bot-icon"
                onError={() => setIconError(true)}
              />
            ) : (
              <LoaderCircle size={22} className="nbot-launcher__spinner" />
            )}
          </span>
        </button>
      }
    >
      <AIAssistant initialOpen />
    </Suspense>
  );
};

export default LazyAIAssistant;