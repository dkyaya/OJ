import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import './styles/app.css'; import './styles/fix.css'; import './styles/loading-fix.css'; import './styles/calendar-menu.css'; import './styles/calendar-v2.css'; import './styles/cloud.css'; import './styles/conflict.css'; import App from './App'; import { CloudAccount } from './components/CloudAccount';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
const cloudRoot=document.createElement('div');cloudRoot.id='oj-cloud-root';document.body.appendChild(cloudRoot);createRoot(cloudRoot).render(<CloudAccount/>);
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
