export type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

// What the auth server action returns to the form.
export type AuthState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { name?: string; email?: string };
};

// The search params an auth page receives (Next.js passes them as a promise).
export type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

// One input in the auth form.
export type AuthFieldConfig = {
  name: "name" | "email" | "password" | "confirmPassword";
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder: string;
  maxLength: number;
  password?: boolean;
};
