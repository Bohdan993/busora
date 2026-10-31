'use client';

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

let browserQueryClient: QueryClient | undefined;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The network and discounts change rarely; booking calls set their own
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        // An API answer (like NO_FLIGHTS) is final; only retry lost requests
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.code !== 'NETWORK_ERROR') &&
          failureCount < 2
      }
    }
  });
}

function getQueryClient() {
  // Keep server renders isolated and the browser cache across navigations
  if (typeof window === 'undefined') return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
