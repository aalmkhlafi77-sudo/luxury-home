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

/**
 * Official Saudi Riyal Symbol (SVG Emblem with SAR fallback)
 */
export const SaudiRiyalSymbol: React.FC<{ className?: string; size?: number; color?: string }> = ({
  className = 'inline-block align-middle',
  size = 14,
  color = 'currentColor',
}) => {
  return (
    <span
      className={`inline-flex items-center align-middle mx-1 select-none font-bold ${className}`}
      title="ريال سعودي (SAR)"
      aria-label="ر.س"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        style={{ color }}
      >
        {/* Official Saudi Riyal Currency Symbol Glyph */}
        <path
          d="M6 4H18M6 8.5H18M6 13H15M6 17.5H12M9 4V20M15 4V13"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
  if (mode === 'sar_text') {
    return `${formatted} SAR`;
  }
  if (mode === 'sar_code') {
    return `${formatted} SAR`;
  }
  return `${formatted} ر.س`;
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
  currencyMode = 'symbol',
  currencyCode = 'SAR',
  className = '',
  symbolSize = 14,
  decimals = 0,
}) => {
  const formatted = formatNumber(amount, {
    maxFractionDigits: decimals,
    minFractionDigits: decimals,
  });

  return (
    <span className={`inline-flex items-center gap-1 font-bold ${className}`}>
      <bdi dir="ltr" className="tabular-nums font-mono">
        {formatted}
      </bdi>
      {currencyMode === 'symbol' ? (
        <SaudiRiyalSymbol size={symbolSize} />
      ) : (
        <span className="text-[11px] font-semibold text-[#68675F]">
          {currencyCode === 'SAR' ? 'ر.س' : currencyCode}
        </span>
      )}
    </span>
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
