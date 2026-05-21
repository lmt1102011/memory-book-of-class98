import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerPwa } from './registerPwa';
import { lockBrowserZoom } from './utils/lockBrowserZoom';

lockBrowserZoom();
registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
