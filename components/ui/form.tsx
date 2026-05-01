import type { FormHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type FormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action?: string | ((formData: FormData) => void | Promise<void>);
};

export function Form({ className, ...props }: FormProps) {
  return <form className={cn("space-y-4", className)} {...props} />;
}
