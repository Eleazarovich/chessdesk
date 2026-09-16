'use client';
import React, { useEffect, useRef, useState } from 'react';
import { getLocalDateString, getLocalTimeString } from '@/lib/dateUtils';

type PickerType = 'date' | 'time';

interface DateTimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type: PickerType;
  /** The selected date used to constrain a time picker to the present. */
  dateValue?: string;
}

export default function DateTimeInput({ type, dateValue, min, onClick, ...props }: DateTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [today, setToday] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateMinimums = () => {
      const now = new Date();
      setToday(getLocalDateString(now));
      setCurrentTime(getLocalTimeString(now));
    };

    updateMinimums();
    const interval = window.setInterval(updateMinimums, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const minimum = min ?? (
    type === 'date'
      ? today
      : dateValue === today
        ? currentTime
        : undefined
  );

  const openPicker = (event: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const pickerInput = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      pickerInput?.showPicker?.();
    } catch {
      // Browsers without a user-initiated picker leave the native behavior intact.
    }
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type={type}
      min={minimum || undefined}
      onClick={openPicker}
    />
  );
}
