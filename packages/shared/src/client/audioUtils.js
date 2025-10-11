// utils dedicated to both HTMLAudio and WebAudio players

/**
 * @typedef {{ source: 'url'|'storage', data: string }} AudioSource
 */

/**
 * Resolve a playable URL from a source object.
 * - For `url`, we try a HEAD to validate, then optionally a fallback origin.
 * - For `storage`, we call the injected `getBlobForStorageSource` and build an object URL.
 *
 * @param {Object} opts
 * @param {AudioSource|null|undefined} opts.source
 * @param {(data: string) => Promise<Blob>} [opts.getBlobForStorageSource]
 * @param {string} [opts.fallbackOrigin='https://playday.ai'] // used when data is a path
 * @param {boolean} [opts.debug=false]
 * @returns {Promise<{ url: string|null, revoke?: () => void }>}
 */
export async function resolveAudioURL({ source, getBlobForStorageSource, fallbackOrigin = 'https://playday.ai', debug = false }) {
    if (!source) return { url: null };
  
    if (source.source === 'storage') {
      if (typeof getBlobForStorageSource !== 'function') {
        if (debug) console.warn('Audio: storage source provided but no getBlobForStorageSource() was passed.');
        return { url: null };
      }
      try {
        const blob = await getBlobForStorageSource(source.data);
        const objectUrl = URL.createObjectURL(blob);
        return { url: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
      } catch (e) {
        if (debug) console.error('Audio: failed to resolve storage blob', e);
        return { url: null };
      }
    }
  
    if (source.source === 'url') {
      const raw = source.data;
      const primary = raw;
      const isAbsolute = /^https?:\/\//i.test(raw);
      const fallback = isAbsolute ? null : `${fallbackOrigin}${raw}`;

      const toURL = (value) => {
        if (!value) return null;
        const base =
          typeof window !== 'undefined' && window?.location?.origin
            ? window.location.origin
            : 'http://localhost';
        try {
          return new URL(value, base);
        } catch {
          return null;
        }
      };

      const isSameOrigin = (urlObj) => {
        if (!urlObj) return false;
        if (typeof window === 'undefined' || !window?.location?.origin) {
          return false;
        }
        return urlObj.origin === window.location.origin;
      };

      const tryHead = async (urlObj) => {
        if (!urlObj || !isSameOrigin(urlObj)) {
          // Skip HEAD checks for cross-origin URLs to avoid noisy CORS errors.
          return false;
        }
        try {
          const res = await fetch(urlObj.href, { method: 'HEAD' });
          return res.ok;
        } catch {
          return false;
        }
      };

      const primaryUrl = toURL(primary);
      const fallbackUrl = toURL(fallback);

      if (await tryHead(primaryUrl)) {
        return { url: primaryUrl.href };
      }
      if (await tryHead(fallbackUrl)) {
        return { url: fallbackUrl.href };
      }

      // Prefer the primary URL if nothing validated, otherwise fall back if available.
      if (primaryUrl) {
        return { url: primaryUrl.href };
      }
      if (fallbackUrl) {
        return { url: fallbackUrl.href };
      }

      // As a last resort, return the raw string (may be relative).
      return { url: primary };
    }
  
    return { url: null };
  }
  
