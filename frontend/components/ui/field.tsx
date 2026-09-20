import * as React from "react";
import { cn } from "../../lib/cn";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactElement<{ id?: string; className?: string }>;
}

/** Associated label + control + hint/error. Control gets 44px+ target. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#101828]">
        {label}
      </label>
      {React.cloneElement(children, {
        id,
        className: cn(
          "min-h-[44px] w-full rounded-lg border border-[#d4cfc2] bg-white px-3 py-2.5 text-sm text-[#101828] placeholder:text-[#667085] disabled:cursor-not-allowed disabled:opacity-50",
          children.props.className
        ),
      })}
      {hint && !error && <p className="mt-1.5 text-[13px] text-[#667085]">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#c4322b]">
          {error}
        </p>
      )}
    </div>
  );
}
