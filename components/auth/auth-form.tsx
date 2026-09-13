"use client";

import type { AuthMode, AuthState } from "@/lib/auth-form";
import { CheckCircle2Icon, EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { submitAuth } from "@/app/(auth)/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

const labels = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  "forgot-password": "Send reset link",
  "reset-password": "Save new password",
};

type FieldConfig = {
  name: "name" | "email" | "password" | "confirmPassword";
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder: string;
  maxLength: number;
  password?: boolean;
};

const NAME: FieldConfig = {
  name: "name",
  label: "Full name",
  type: "text",
  autoComplete: "name",
  placeholder: "Your name",
  maxLength: 100,
};

const EMAIL: FieldConfig = {
  name: "email",
  label: "Email address",
  type: "email",
  autoComplete: "email",
  placeholder: "you@example.com",
  maxLength: 254,
};

const PASSWORD: FieldConfig = {
  name: "password",
  label: "Password",
  type: "password",
  autoComplete: "current-password",
  placeholder: "Enter your password",
  maxLength: 128,
  password: true,
};

const NEW_PASSWORD: FieldConfig = {
  ...PASSWORD,
  label: "New password",
  autoComplete: "new-password",
};

const CONFIRM_PASSWORD: FieldConfig = {
  ...NEW_PASSWORD,
  name: "confirmPassword",
  label: "Confirm new password",
  placeholder: "Re-enter your password",
};

const fieldSets: Record<AuthMode, FieldConfig[]> = {
  "sign-in": [EMAIL, PASSWORD],
  "sign-up": [NAME, EMAIL, PASSWORD],
  "forgot-password": [EMAIL],
  "reset-password": [NEW_PASSWORD, CONFIRM_PASSWORD],
};

export function AuthForm({
  mode,
  next = "/",
  token,
}: {
  mode: AuthMode;
  next?: string;
  token?: string;
}) {
  const [state, action, pending] = useActionState(submitAuth.bind(null, mode), {} as AuthState);
  const [showPassword, setShowPassword] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.error || state.success) feedback.current?.focus();
  }, [state]);
  const fields = fieldSets[mode];
  const passwordFieldIds = fields
    .filter((field) => field.password)
    .map((field) => `${mode}-${field.name}`)
    .join(" ");
  if (state.success)
    return (
      <div className="flex flex-col gap-6" ref={feedback} tabIndex={-1}>
        <Alert role="status">
          <CheckCircle2Icon />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            {mode === "sign-up"
              ? `Check ${state.values?.email} for a verification link to finish creating your account.`
              : `If an account exists for ${state.values?.email}, you’ll receive a password reset link.`}{" "}
            Check your spam folder, too.
          </AlertDescription>
        </Alert>
        {mode === "forgot-password" && (
          <Button variant="outline" nativeButton={false} render={<Link href="/forgot-password" />}>
            Try another email
          </Button>
        )}
      </div>
    );
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      {token && <input type="hidden" name="token" value={token} />}
      <FieldGroup className="gap-5">
        {state.error && (
          <div ref={feedback} tabIndex={-1}>
            <Alert variant="destructive">
              <AlertTitle>Let’s try that again</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </div>
        )}
        {fields.map((field) => {
          const id = `${mode}-${field.name}`;
          const errors = state.fieldErrors?.[field.name];
          const hint = field.password && mode !== "sign-in";
          const control = {
            id,
            name: field.name,
            type: field.password && showPassword ? "text" : field.type,
            placeholder: field.placeholder,
            autoComplete: field.autoComplete,
            maxLength: field.maxLength,
            className: "h-11",
            required: true,
            disabled: pending,
            minLength: field.password && mode !== "sign-in" ? 8 : undefined,
            defaultValue:
              field.name === "email"
                ? state.values?.email
                : field.name === "name"
                  ? state.values?.name
                  : undefined,
            "aria-invalid": !!errors,
            "aria-describedby": errors ? `${id}-error` : hint ? `${id}-hint` : undefined,
          };
          return (
            <Field key={field.name} data-invalid={!!errors}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
                {field.name === "password" && mode === "sign-in" && (
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              {field.password ? (
                <InputGroup className="h-11">
                  <InputGroupInput {...control} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      aria-controls={passwordFieldIds}
                      disabled={pending}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              ) : (
                <Input {...control} />
              )}
              {hint && <FieldDescription id={`${id}-hint`}>Use 8–128 characters.</FieldDescription>}
              {errors && <FieldError id={`${id}-error`}>{errors.join(" ")}</FieldError>}
            </Field>
          );
        })}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Please wait…" : labels[mode]}
        </Button>
        {mode === "reset-password" && (
          <Link
            href="/forgot-password"
            className="text-center text-sm underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        )}
      </FieldGroup>
    </form>
  );
}
