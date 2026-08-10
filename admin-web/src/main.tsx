import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminAuthProvider } from '@/features/auth';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminAuthProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </AdminAuthProvider>
  </StrictMode>,
);
