import './App.css';
import '../globals';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { HashRouter } from 'react-router-dom';

import { AppRouter } from '@/app/Router';
import { ScreenLoader, Toaster } from '@/components';
import { DataProvider } from '@/data';
import { AuthProvider } from '@/guards';
import { InitWalletConnectManager } from '@/managers/InitWalletConnectManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider />
        <HashRouter>
          <Suspense fallback={<ScreenLoader />}>
            <InitWalletConnectManager>
              <AppRouter />
            </InitWalletConnectManager>
            <Toaster />
          </Suspense>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
