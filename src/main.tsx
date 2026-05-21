import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { lockBrowserZoom } from './utils/lockBrowserZoom';

lockBrowserZoom();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
