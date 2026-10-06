/**
 * Dynamic CSS Theme Variables Manager
 * Dynamically applies CSS custom properties to document.documentElement (:root)
 * whenever settings/theme updates from API / Database without relying on localStorage.
 */

export function applyCssThemeVariables(theme?: {
  headerBg?: string;
  footerBg?: string;
  primaryBtnBg?: string;
  pageBg?: string;
  primaryColor?: string;
}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const headerBg = theme?.headerBg || '#FFFCF6';
  const footerBg = theme?.footerBg || '#282824';
  const primaryBtnBg = theme?.primaryBtnBg || theme?.primaryColor || '#B69A68';
  const pageBg = theme?.pageBg || '#FAF8F5';

  root.style.setProperty('--color-header-bg', headerBg);
  root.style.setProperty('--color-footer-bg', footerBg);
  root.style.setProperty('--color-primary-btn-bg', primaryBtnBg);
  root.style.setProperty('--color-page-bg', pageBg);
}
