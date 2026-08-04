import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import './styles/app.css'; import './styles/fix.css'; import './styles/loading-fix.css'; import './styles/calendar-menu.css'; import './styles/calendar-v2.css'; import App from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
