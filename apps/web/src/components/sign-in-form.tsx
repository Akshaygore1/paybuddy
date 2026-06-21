import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@my-better-t-app/ui/components/field";
import { Button } from "@my-better-t-app/ui/components/button";
import { Input } from "@my-better-t-app/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm() {
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <FieldGroup>
        <form.Field name="email">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;

            return (
              <Field data-invalid={hasError || undefined}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={hasError}
                />
                <FieldDescription>Use the email address tied to your account.</FieldDescription>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="password">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;

            return (
              <Field data-invalid={hasError || undefined}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={hasError}
                />
                <FieldDescription>Passwords must be at least 8 characters.</FieldDescription>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
