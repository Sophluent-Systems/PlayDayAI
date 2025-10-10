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
      const tryHead = async (u) => {
        try {
          const res = await fetch(u, { method: 'HEAD' });
          return res.ok;
        } catch {
          return false;
        }
      };
  
      const raw = source.data;
      const primary = raw;
      const isAbsolute = /^https?:\/\//i.test(raw);
      const fallback = isAbsolute ? null : `${fallbackOrigin}${raw}`;
  
      if (await tryHead(primary)) return { url: primary };
      if (fallback && (await tryHead(fallback))) return { url: fallback };
  
      // As a last resort, return the primary URL even if HEAD failed (some CDNs block HEAD).
      if (debug) console.warn('Audio: HEAD checks failed; falling back to primary URL anyway.');
      return { url: primary };
    }
  
    return { url: null };
  }
  