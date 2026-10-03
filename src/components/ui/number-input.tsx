"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  fieldToNumber,
  formatIdDecimal,
  formatIdInteger,
  parseIdNumber,
  sanitizeDecimalTyping,
} from "@/lib/numbers";
import { cn } from "@/lib/utils";

type BaseProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "defaultValue"
> & {
  className?: string;
};

/** Rupiah / nominal bulat — tampil 100.000, 1.000.000 */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  className,
  ...props
}: BaseProps & {
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(() => formatIdInteger(value));

  useEffect(() => {
    setText(formatIdInteger(value));
  }, [value]);

  return (
    <Input
      {...props}
      className={cn("tabular-nums", className)}
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "");
        const n = digits ? parseInt(digits, 10) : 0;
        setText(digits ? formatIdInteger(n) : "");
        onChange(n);
      }}
      onBlur={(e) => {
        setText(formatIdInteger(value));
        onBlur?.(e);
      }}
    />
  );
}

/** Angka desimal (tonase, liter) — ribuan titik, desimal koma */
export function DecimalInput({
  value,
  onChange,
  onBlur,
  decimals = 2,
  className,
  ...props
}: BaseProps & {
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
}) {
  const [text, setText] = useState(() => formatIdDecimal(value, decimals));

  useEffect(() => {
    setText(formatIdDecimal(value, decimals));
  }, [value, decimals]);

  return (
    <Input
      {...props}
      className={cn("tabular-nums", className)}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = sanitizeDecimalTyping(e.target.value, decimals);
        setText(raw);
        onChange(parseIdNumber(raw));
      }}
      onBlur={(e) => {
        const n = parseIdNumber(text);
        onChange(n);
        setText(n === 0 ? "" : formatIdDecimal(n, decimals));
        onBlur?.(e);
      }}
    />
  );
}

/** Bridge untuk form state string (DO verify / edit). */
export function MoneyField({
  value,
  onChange,
  ...props
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <MoneyInput
      {...props}
      value={fieldToNumber(value)}
      onChange={(n) => onChange(n === 0 ? "" : String(n))}
    />
  );
}

/** Tonase / desimal — simpan string di form; mendukung 30,5 dan 30.57 */
export function DecimalField({
  value,
  onChange,
  decimals = 3,
  onBlur,
  className,
  ...props
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <Input
      {...props}
      className={cn("tabular-nums", className)}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = sanitizeDecimalTyping(e.target.value, decimals);
        setText(raw);
        onChange(raw);
      }}
      onBlur={(e) => {
        const n = parseIdNumber(text);
        if (!text.trim()) {
          onChange("");
          setText("");
        } else {
          const normalized = String(
            Math.round(n * 10 ** decimals) / 10 ** decimals
          );
          onChange(normalized);
          setText(formatIdDecimal(n, decimals) || normalized);
        }
        onBlur?.(e);
      }}
    />
  );
}

/** Bilangan bulat dengan pemisah ribuan (opsional untuk angka besar) */
export function IntegerInput({
  value,
  onChange,
  onBlur,
  className,
  ...props
}: BaseProps & {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <MoneyInput
      {...props}
      className={className}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}
