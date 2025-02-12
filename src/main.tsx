import { Buffer } from 'buffer';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Make Buffer available globally
window.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);