import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { capturePwaInstallPrompt } from './pwaInstallPrompt';
import { registerPwa } from './registerPwa';
import { installInstalledAppVersionCheck } from './utils/installedAppVersionCheck';
import { installUpdateRecovery } from './utils/appUpdateRecovery';
import { lockBrowserZoom } from './utils/lockBrowserZoom';

lockBrowserZoom();
capturePwaInstallPrompt();
installUpdateRecovery();
registerPwa();
installInstalledAppVersionCheck();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
