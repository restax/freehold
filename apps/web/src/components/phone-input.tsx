"use client";

import { type ChangeEvent, type InputHTMLAttributes, useRef } from "react";
import { digitsOf, formatUsDigits, isFormattableUsPhone } from "@/lib/phone";

/**
 * An input that shapes US numbers into (312) 555-0101 as you type.
 *
 * A drop-in replacement for a plain <input>: uncontrolled, submits with the
 * form under its `name` like any other field, so the server actions that read
 * `str(formData, "phone")` never know the difference.
 *
 * Two things make as-you-type formatting livable rather than infuriating:
 *
 *  - The caret is restored by *digit position*, not character position, so
 *    typing into the middle of a number doesn't fling the cursor to the end
 *    every time the dressing shifts around it.
 *  - Backspacing over dressing deletes the digit before it. Without this,
 *    deleting the ")" would reformat and put the ")" straight back, and the
 *    field would fight the user.
 *
 * Anything that isn't a plain US number (a "+81…", an "x22" extension, a
 * note) is passed through untouched; see lib/phone.ts.
 */
export function PhoneInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const prev = useRef<string | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const value = el.value;
    const before =
      prev.current ?? (typeof props.defaultValue === "string" ? props.defaultValue : "");

    if (!isFormattableUsPhone(value)) {
      prev.current = value;
      props.onChange?.(e);
      return;
    }

    let digits = digitsOf(value);
    // A deletion that removed only dressing means the user backspaced over a
    // ")" or "-": take the digit they were reaching for as well.
    const caret = el.selectionStart ?? value.length;
    if (value.length < before.length && digits === digitsOf(before)) {
      const digitsBeforeCaret = digitsOf(value.slice(0, caret)).length;
      digits =
        digits.slice(0, Math.max(0, digitsBeforeCaret - 1)) + digits.slice(digitsBeforeCaret);
    }

    const digitsBeforeCaret = digitsOf(value.slice(0, caret)).length;
    const formatted = formatUsDigits(digits);
    if (formatted !== value) {
      el.value = formatted;
      // Restore the caret after the same digit it followed before the reflow.
      let seen = 0;
      let pos = formatted.length;
      const target = Math.min(digitsBeforeCaret, digits.length);
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) seen++;
        if (seen === target) {
          pos = i + 1;
          break;
        }
      }
      if (target === 0) pos = 0;
      el.setSelectionRange(pos, pos);
    }
    prev.current = el.value;
    props.onChange?.(e);
  }

  return (
    <input
      type="tel"
      autoComplete="tel"
      {...props}
      defaultValue={
        typeof props.defaultValue === "string" && isFormattableUsPhone(props.defaultValue)
          ? formatUsDigits(digitsOf(props.defaultValue))
          : props.defaultValue
      }
      onChange={onChange}
    />
  );
}
