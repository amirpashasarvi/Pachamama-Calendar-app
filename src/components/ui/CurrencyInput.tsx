import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

function formatWithCommas(n: number): string {
  if (n === 0) return '';
  // Up to 2 decimal places, strip trailing zeros
  const formatted = n % 1 === 0
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formatted;
}

function parseRaw(s: string): number {
  const stripped = s.replace(/,/g, '').trim();
  if (stripped === '' || stripped === '-') return 0;
  const n = parseFloat(stripped);
  return isNaN(n) ? 0 : n;
}

export default function CurrencyInput({ value, onChange, className, placeholder, disabled }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // When not focused, derive display from the numeric value
  const display = focused ? raw : formatWithCommas(value);

  const handleFocus = () => {
    // Show raw number (no commas, no trailing zeros) for easy editing
    setRaw(value === 0 ? '' : String(value));
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
    onChange(parseRaw(raw));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    // Allow digits, one dot, and commas (commas stripped on parse)
    if (/^[0-9,]*\.?[0-9]*$/.test(v) || v === '') {
      setRaw(v);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={display}
      placeholder={placeholder ?? '0'}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={cn(
        "w-full outline-none bg-gray-50 font-mono",
        className
      )}
    />
  );
}
