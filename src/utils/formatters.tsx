import React from 'react';

/**
 * Unified Formatting and Directional Isolation Utilities
 * Enforces ASCII Latin digits (0 1 2 3 4 5 6 7 8 9), Gregorian calendar dates,
 * Saudi Riyal currency symbol / SAR, and <bdi dir="ltr"> visual isolation.
 */

// Format standard numbers using ASCII Latin digits
export const numberFormatter = new Intl.NumberFormat('en-US', {
  numberingSystem: 'latn',
  maximumFractionDigits: 2,
});

export const integerFormatter = new Intl.NumberFormat('en-US', {
  numberingSystem: 'latn',
  maximumFractionDigits: 0,
});

// Format Gregorian Dates in readable format with Latin digits (e.g. 06 Oct 2026)
export const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  calendar: 'gregory',
  numberingSystem: 'latn',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

// Format Gregorian Dates numeric (e.g. 06/10/2026)
export const dateNumericFormatter = new Intl.DateTimeFormat('en-GB', {
  calendar: 'gregory',
  numberingSystem: 'latn',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Format Time (e.g. 15:00)
export const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  calendar: 'gregory',
  numberingSystem: 'latn',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Format any number or numeric string to Latin ASCII formatted string
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: { maxFractionDigits?: number; minFractionDigits?: number }
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '0';

  if (options && (options.maxFractionDigits !== undefined || options.minFractionDigits !== undefined)) {
    const customFormatter = new Intl.NumberFormat('en-US', {
      numberingSystem: 'latn',
      maximumFractionDigits: options.maxFractionDigits ?? 2,
      minimumFractionDigits: options.minFractionDigits ?? 0,
    });
    return customFormatter.format(num);
  }

  return numberFormatter.format(num);
}

/**
 * Format integer values (e.g. counts, nights, units)
 */
export function formatInteger(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseInt(value.replace(/[^0-9-]/g, ''), 10) : Math.round(value);
  if (isNaN(num)) return '0';
  return integerFormatter.format(num);
}

/**
 * Format percentage (e.g. 15% or 99.8%)
 */
export function formatPercentage(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || value === '') return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  const formatted = formatNumber(num, { maxFractionDigits: decimals, minFractionDigits: decimals });
  return `${formatted}%`;
}

/**
 * Format date to Gregorian string with Latin digits (e.g. "06 Oct 2026" or "06/10/2026")
 */
export function formatDate(
  dateValue: string | Date | number | null | undefined,
  formatStyle: 'medium' | 'numeric' | 'short' = 'medium'
): string {
  if (!dateValue) return '';
  const d = typeof dateValue === 'string' || typeof dateValue === 'number' ? new Date(dateValue) : dateValue;
  if (isNaN(d.getTime())) return String(dateValue);

  if (formatStyle === 'numeric') {
    return dateNumericFormatter.format(d);
  }
  return dateFormatter.format(d);
}

//Official SAMA Saudi Riyal Symbol SVG Paths (Approved Feb 20, 2025 - Unicode U+20C1)
export const OFFICIAL_SAUDI_RIYAL_VIEWBOX = '0 0 1124.14 1256.39';
export const OFFICIAL_SAUDI_RIYAL_PATH_1 =
  'M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z';
export const OFFICIAL_SAUDI_RIYAL_PATH_2 =
  'M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z';

let globalCurrencyDisplayMode: 'symbol' | 'code' = 'symbol';

export function setGlobalCurrencyDisplayMode(mode: 'symbol' | 'code') {
  globalCurrencyDisplayMode = mode === 'code' ? 'code' : 'symbol';
}

export function getGlobalCurrencyDisplayMode(): 'symbol' | 'code' {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('luxury_home_platform_data_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.settings?.currencyDisplayMode === 'code') return 'code';
        if (parsed?.settings?.currencyDisplayMode === 'symbol') return 'symbol';
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return globalCurrencyDisplayMode;
}

/**
 * Official Saudi Riyal Symbol (SAMA Official SVG Emblem with SAR fallback)
 */
export const SaudiRiyalSymbol: React.FC<{
  className?: string;
  size?: number;
  color?: string;
  forceFallback?: boolean;
}> = ({
  className = 'inline-block align-middle',
  size = 14,
  color = 'currentColor',
  forceFallback = false,
}) => {
  const [svgFailed, setSvgFailed] = React.useState(false);

  if (forceFallback || svgFailed) {
    return (
      <bdi
        dir="ltr"
        className={`inline-flex items-center align-middle mx-0.5 font-mono font-bold text-[0.85em] ${className}`}
        title="ريال سعودي (SAR)"
      >
        SAR
      </bdi>
    );
  }

  const height = Math.round(size * (1256.39 / 1124.14) * 10) / 10;

  return (
    <span
      className={`inline-flex items-center align-middle mx-0.5 select-none ${className}`}
      title="ريال سعودي (SAR)"
      aria-label="SAR"
      data-testid="saudi-riyal-symbol"
    >
      <svg
        width={size}
        height={height}
        viewBox={OFFICIAL_SAUDI_RIYAL_VIEWBOX}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 inline-block"
        style={{ color }}
        role="img"
        aria-hidden="true"
        onError={() => setSvgFailed(true)}
      >
        <path fill="currentColor" d={OFFICIAL_SAUDI_RIYAL_PATH_1} />
        <path fill="currentColor" d={OFFICIAL_SAUDI_RIYAL_PATH_2} />
      </svg>
      <span className="sr-only">SAR</span>
    </span>
  );
};

/**
 * Convert Arabic-Indic digits (٠-٩) to ASCII Latin digits (0-9)
 */
export function toLatinDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/**
 * Directional isolation string helper
 */
export function isolateDirectional(str: string): string {
  return `\u2066${str}\u2069`;
}

/**
 * Format currency with Latin digits and chosen symbol mode
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  mode: 'symbol' | 'sar_text' | 'sar_code' = 'symbol'
): string {
  const formatted = formatNumber(amount);
  return `${formatted} SAR`;
}

/**
 * Format percent string helper alias
 */
export function formatPercent(value: number | string | null | undefined, decimals: number = 0): string {
  return formatPercentage(value, decimals);
}

/**
 * Format currency with Latin digits and chosen symbol mode (legacy alias)
 */
export function formatCurrencyString(
  amount: number | string | null | undefined,
  currencyCode: string = 'SAR'
): string {
  const formatted = formatNumber(amount);
  return `${formatted} ${currencyCode}`;
}

/**
 * Directionally isolated Latin Number Component (<bdi dir="ltr">)
 * Ensures numbers, amounts, phone numbers, and codes never invert in RTL layouts.
 */
export const LatinNumber: React.FC<{
  value: number | string | null | undefined;
  className?: string;
  decimals?: number;
}> = ({ value, className = '', decimals }) => {
  const formatted = formatNumber(value, {
    maxFractionDigits: decimals,
    minFractionDigits: decimals,
  });

  return (
    <bdi dir="ltr" className={`tabular-nums font-mono ${className}`}>
      {formatted}
    </bdi>
  );
};

/**
 * Directionally isolated Currency Display Component
 */
export const CurrencyAmount: React.FC<{
  amount: number | string | null | undefined;
  currencyMode?: 'symbol' | 'code' | 'text';
  currencyCode?: string;
  className?: string;
  symbolSize?: number;
  decimals?: number;
}> = ({
  amount,
  currencyMode,
  currencyCode = 'SAR',
  className = '',
  symbolSize = 14,
  decimals = 0,
}) => {
  const effectiveMode = currencyMode || getGlobalCurrencyDisplayMode();
  const formatted = formatNumber(amount, {
    maxFractionDigits: decimals,
    minFractionDigits: decimals,
  });

  return (
    <bdi dir="ltr" className={`inline-flex items-center gap-1 font-bold tabular-nums font-mono ${className}`}>
      <span>{formatted}</span>
      {effectiveMode === 'symbol' ? (
        <SaudiRiyalSymbol size={symbolSize} />
      ) : (
        <span className="text-[0.8em] font-bold tracking-wider opacity-85">
          {currencyCode}
        </span>
      )}
    </bdi>
  );
};

/**
 * Directionally isolated Code / Identifier Display
 */
export const LatinCode: React.FC<{
  code: string | null | undefined;
  className?: string;
}> = ({ code, className = '' }) => {
  if (!code) return null;
  return (
    <bdi dir="ltr" className={`tabular-nums font-mono tracking-wider select-all ${className}`}>
      {code}
    </bdi>
  );
};
