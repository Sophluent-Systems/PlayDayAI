import { nullUndefinedOrEmpty } from '@src/common/objects';
import React, { useState, useEffect, use } from 'react';

export function ImageWithFallback({ primary, fallback, ...props }) {
    const [internalSrc, setInternalSrc] = useState("");

    useEffect(() => {
        if (!nullUndefinedOrEmpty(primary)) {
            setInternalSrc(primary);
        }
    }, [primary]);


    useEffect(() => {
        function setFallbackImg(event) {
            if (!nullUndefinedOrEmpty(internalSrc)) {
                setInternalSrc(fallback);
            }
        }
        document.getElementById('mainImage')?.addEventListener('error', setFallbackImg);

        return () => {
            document.getElementById('mainImage')?.removeEventListener('error', setFallbackImg);
        }
    }), [];

    return (
      <img id="mainImage" src={internalSrc} {...props} />
    );
  }
