import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed === 'true') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS / browsers that don't fire beforeinstallprompt, show a generic tip
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone && dismissed !== 'true') {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    setShowBanner(false);
  };

  const handleDismissForever = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-slide-in md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-spc flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
              SPC
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Instalar SPC Vendas</h3>
              <p className="text-xs text-muted-foreground">Acesse direto da tela inicial do seu dispositivo</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Download size={16} /> Instalar App
          </button>
        </div>

        <button
          onClick={handleDismissForever}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition"
        >
          Não exibir novamente
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
