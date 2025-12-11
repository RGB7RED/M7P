'use client';

import { useEffect } from 'react';

import { useGoToHub } from '../../lib/navigation';

const EDGE_THRESHOLD = 40;
const SWIPE_DISTANCE = 80;
const MAX_VERTICAL_DRIFT = 50;

export function useSwipeBackToHub(enabled: boolean) {
  const goToHub = useGoToHub();

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      if (touch.clientX > EDGE_THRESHOLD) return;

      tracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (dy > MAX_VERTICAL_DRIFT) {
        tracking = false;
        return;
      }

      if (dx > SWIPE_DISTANCE) {
        tracking = false;
        goToHub();
      }
    }

    function onTouchEnd() {
      tracking = false;
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, goToHub]);
}
