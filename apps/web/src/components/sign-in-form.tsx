import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@paybuddy/ui/components/field";
import { Button } from "@paybuddy/ui/components/button";
import { Input } from "@paybuddy/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm() {
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      const normalizedIdentifier = value.identifier.trim();
      const result = await (normalizedIdentifier.includes("@")
        ? authClient.signIn.email({
            email: normalizedIdentifier,
            password: value.password,
          })
        : authClient.signIn.username({
            username: normalizedIdentifier,
            password: value.password,
          }));

      if (result.error) {
        toast.error(result.error.message || result.error.statusText);
        return;
      }

      toast.success("Sign in successful");
    },
    validators: {
      onSubmit: z.object({
        identifier: z.string().trim().min(1, "Email or username is required"),
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
        <form.Field name="identifier">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;

            return (
              <Field data-invalid={hasError || undefined}>
                <FieldLabel htmlFor={field.name}>Email or Username</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  autoComplete="username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={hasError}
                />
                <FieldDescription>
                  Admins can sign in with email. Institution accounts sign in with username.
                </FieldDescription>
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
