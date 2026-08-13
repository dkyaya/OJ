import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';
import './styles/auth.css';
import './styles/idea-lifecycle.css';
import './styles/collaboration.css';
import './styles/visual-polish.css';
import './styles/intelligence.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
