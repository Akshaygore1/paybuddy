import {
  createInstitutionStep1Schema,
  createInstitutionStep2Schema,
} from "@paybuddy/api/schemas/institutions";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@paybuddy/ui/components/field";
import { Input } from "@paybuddy/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { queryClient, trpc } from "@/utils/trpc";

type CreateInstitutionFormValues = {
  name: string;
  tanNumber: string;
  institutionHead: string;
  address: string;
  username: string;
  password: string;
};

type FormErrors = Partial<Record<keyof CreateInstitutionFormValues, string>>;

const initialValues: CreateInstitutionFormValues = {
  name: "",
  tanNumber: "",
  institutionHead: "",
  address: "",
  username: "",
  password: "",
};

export default function InstitutionsCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<CreateInstitutionFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  const createInstitutionMutation = useMutation(
    trpc.institutions.create.mutationOptions({
      onSuccess: async (institution) => {
        toast.success("Institution created successfully");
        setValues(initialValues);
        setErrors({});
        setStep(1);
        await queryClient.invalidateQueries();
        navigate(`/institutions/${institution.id}`);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  function updateValue<Key extends keyof CreateInstitutionFormValues>(
    key: Key,
    value: CreateInstitutionFormValues[Key],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function validateStep1() {
    const parsed = createInstitutionStep1Schema.safeParse(values);

    if (parsed.success) {
      setErrors((current) => ({
        ...current,
        name: undefined,
        tanNumber: undefined,
        institutionHead: undefined,
        address: undefined,
      }));
      return true;
    }

    const nextErrors: FormErrors = {};

    for (const issue of parsed.error.issues) {
      const fieldName = issue.path[0] as keyof CreateInstitutionFormValues;
      nextErrors[fieldName] = issue.message;
    }

    setErrors((current) => ({
      ...current,
      ...nextErrors,
    }));
    return false;
  }

  function validateStep2() {
    const parsed = createInstitutionStep2Schema.safeParse(values);

    if (parsed.success) {
      setErrors((current) => ({
        ...current,
        username: undefined,
        password: undefined,
      }));
      return true;
    }

    const nextErrors: FormErrors = {};

    for (const issue of parsed.error.issues) {
      const fieldName = issue.path[0] as keyof CreateInstitutionFormValues;
      nextErrors[fieldName] = issue.message;
    }

    setErrors((current) => ({
      ...current,
      ...nextErrors,
    }));
    return false;
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
      return;
    }

    if (!validateStep2()) {
      return;
    }

    await createInstitutionMutation.mutateAsync(values);
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Create Institution"
        description="Set up institution details first, then create the institution login."
        action={
          <Button variant="outline" onClick={() => navigate("/institutions")}>
            Cancel
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Create institution</CardTitle>
          <CardDescription>
            Step {step} of 2. Institution Head replaces the old Principal Name field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleCreateSubmit}>
            {step === 1 ? (
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.name) || undefined}>
                  <FieldLabel htmlFor="institution-name">Institution Name</FieldLabel>
                  <Input
                    id="institution-name"
                    value={values.name}
                    onChange={(event) => updateValue("name", event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                  />
                  <FieldError>{errors.name}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.tanNumber) || undefined}>
                  <FieldLabel htmlFor="institution-tan-number">TAN Number</FieldLabel>
                  <Input
                    id="institution-tan-number"
                    value={values.tanNumber}
                    onChange={(event) => updateValue("tanNumber", event.target.value)}
                    aria-invalid={Boolean(errors.tanNumber)}
                  />
                  <FieldError>{errors.tanNumber}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.institutionHead) || undefined}>
                  <FieldLabel htmlFor="institution-head">Institution Head</FieldLabel>
                  <Input
                    id="institution-head"
                    value={values.institutionHead}
                    onChange={(event) => updateValue("institutionHead", event.target.value)}
                    aria-invalid={Boolean(errors.institutionHead)}
                  />
                  <FieldError>{errors.institutionHead}</FieldError>
                </Field>
                <Field className="md:col-span-2" data-invalid={Boolean(errors.address) || undefined}>
                  <FieldLabel htmlFor="institution-address">Address</FieldLabel>
                  <Input
                    id="institution-address"
                    value={values.address}
                    onChange={(event) => updateValue("address", event.target.value)}
                    aria-invalid={Boolean(errors.address)}
                  />
                  <FieldError>{errors.address}</FieldError>
                </Field>
              </FieldGroup>
            ) : (
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.username) || undefined}>
                  <FieldLabel htmlFor="institution-username">Username or Email</FieldLabel>
                  <Input
                    id="institution-username"
                    autoComplete="username"
                    value={values.username}
                    onChange={(event) => updateValue("username", event.target.value)}
                    aria-invalid={Boolean(errors.username)}
                  />
                  {!errors.username ? (
                    <FieldDescription>
                      Use either a handle like `greenfield_admin` or a full email address.
                    </FieldDescription>
                  ) : null}
                  <FieldError>{errors.username}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.password) || undefined}>
                  <FieldLabel htmlFor="institution-password">Password</FieldLabel>
                  <Input
                    id="institution-password"
                    type="password"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={(event) => updateValue("password", event.target.value)}
                    aria-invalid={Boolean(errors.password)}
                  />
                  <FieldError>{errors.password}</FieldError>
                </Field>
              </FieldGroup>
            )}

            <div className="flex flex-wrap gap-3">
              {step === 2 ? (
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
              ) : null}
              <Button type="submit" disabled={createInstitutionMutation.isPending}>
                {step === 1
                  ? "Continue"
                  : createInstitutionMutation.isPending
                    ? "Creating..."
                    : "Create Institution"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
