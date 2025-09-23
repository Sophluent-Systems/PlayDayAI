import { nullUndefinedOrEmpty } from '@src/common/objects';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export function ImageWithFallback({ primary, fallback, ...props }) {
  const imgRef = useRef(null);
  const initialSrc = useMemo(() => {
    if (!nullUndefinedOrEmpty(primary)) {
      return primary;
    }
    if (!nullUndefinedOrEmpty(fallback)) {
      return fallback;
    }
    return null;
  }, [primary, fallback]);
  const [src, setSrc] = useState(initialSrc);

  useEffect(() => {
    if (!nullUndefinedOrEmpty(primary)) {
      setSrc(primary);
    } else if (!nullUndefinedOrEmpty(fallback)) {
      setSrc(fallback);
    } else {
      setSrc(null);
    }
  }, [primary, fallback]);

  useEffect(() => {
    const node = imgRef.current;
    if (!node) {
      return undefined;
    }

    function handleError() {
      setSrc((current) => {
        if (!nullUndefinedOrEmpty(fallback) && current !== fallback) {
          return fallback;
        }
        return null;
      });
    }

    node.addEventListener('error', handleError);
    return () => {
      node.removeEventListener('error', handleError);
    };
  }, [fallback]);

  if (!src) {
    return null;
  }

  return <img ref={imgRef} src={src} {...props} />;
}
