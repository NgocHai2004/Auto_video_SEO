import { useEffect, useState } from 'react';
import { getBackgrounds, getVoices } from '../api/backgrounds';

export function useBackgrounds() {
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBackgrounds()
      .then(setBackgrounds)
      .catch(() => setBackgrounds([]))
      .finally(() => setLoading(false));
  }, []);

  return { backgrounds, loading };
}

export function useVoices() {
  const [voices, setVoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVoices()
      .then(setVoices)
      .catch(() => setVoices([]))
      .finally(() => setLoading(false));
  }, []);

  return { voices, loading };
}
