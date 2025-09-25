import { useState, useEffect } from 'react';

/**
 * Custom hook for tracking viewport dimensions with debouncing
 * Provides stable width/height values that update smoothly during resize
 */
export function useViewportDimensions() {
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 1024, height: 768 }; // SSR fallback
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let timeoutId = null;
    let rafId = null;

    const updateDimensions = () => {
      // Cancel any pending updates
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      // Use RAF for smooth updates
      rafId = requestAnimationFrame(() => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        setDimensions(prev => {
          // Only update if dimensions actually changed
          if (prev.width === newWidth && prev.height === newHeight) {
            return prev;
          }
          return { width: newWidth, height: newHeight };
        });
      });
    };

    // Immediate update on mount
    updateDimensions();

    // Debounced resize handler
    const handleResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Small debounce to avoid excessive updates
      timeoutId = setTimeout(updateDimensions, 16); // ~60fps
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation change on mobile
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return dimensions;
}
