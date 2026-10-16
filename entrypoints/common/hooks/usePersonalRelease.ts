import { useEffect, useState } from 'react';
import { checkPersonalRelease } from '../release/check.ts';
import type { AvailableRelease } from '../release/manifest.ts';

export default function usePersonalRelease(): AvailableRelease | null {
  const [release, setRelease] = useState<AvailableRelease | null>(null);

  useEffect(() => {
    if (import.meta.env.FIREFOX) return;
    const manifestUrl = import.meta.env.WXT_UPDATE_MANIFEST_URL;
    if (!manifestUrl) return;

    let active = true;
    checkPersonalRelease(manifestUrl, browser.runtime.getURL('release.json'), fetch).then(
      found => {
        if (active) setRelease(found);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return release;
}
