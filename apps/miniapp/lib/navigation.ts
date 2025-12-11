'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useGoToHub() {
  const router = useRouter();

  const goToHub = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      return;
    }

    router.push('/');
  }, [router]);

  return goToHub;
}
