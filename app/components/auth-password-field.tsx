"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

type AuthPasswordFieldProps = {
  autoComplete?: string;
  id?: string;
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  value: string;
};

export function AuthPasswordField({
  autoComplete,
  id,
  label,
  minLength,
  onChange,
  placeholder,
  required = true,
  value,
}: AuthPasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,165,233,0.15)]"
        />
        <button
          type="button"
          onClick={() => setIsVisible((currentValue) => !currentValue)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-slate-500 hover:text-slate-800"
          aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
