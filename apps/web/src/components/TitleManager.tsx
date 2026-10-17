import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Keeps the browser tab title in sync with where the player is. */
export function TitleManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pathname.startsWith('/bhabi-thulla')
      ? "Zunair's Playground - Bhabi Thulla"
      : "Zunair's Playground";
  }, [pathname]);
  return null;
}
