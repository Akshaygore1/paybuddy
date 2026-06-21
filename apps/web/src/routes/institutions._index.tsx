import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { Button } from "@paybuddy/ui/components/button";
import { Input } from "@paybuddy/ui/components/input";
import {
  createInstitutionStep1Schema,
  createInstitutionStep2Schema,
} from "@paybuddy/api/schemas/institutions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
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

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InstitutionsIndexPage() {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<CreateInstitutionFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  const institutionsQuery = useQuery(trpc.institutions.list.queryOptions());

  const createInstitutionMutation = useMutation(
    trpc.institutions.create.mutationOptions({
      onSuccess: async (institution) => {
        toast.success("Institution created successfully");
        setValues(initialValues);
        setErrors({});
        setStep(1);
        setIsCreateOpen(false);
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
        title="Institution"
        description="Create and manage institution logins, profile details, and access status."
        action={
          <Button
            onClick={() => {
              setIsCreateOpen((current) => !current);
              setStep(1);
              setErrors({});
            }}
          >
            {isCreateOpen ? "Close" : "Create Institution"}
          </Button>
        }
      />

      {isCreateOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>Create institution</CardTitle>
            <CardDescription>
              Step {step} of 2. Institution Head replaces the old Principal Name field.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleCreateSubmit}>
              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Institution Name</span>
                    <Input
                      value={values.name}
                      onChange={(event) => updateValue("name", event.target.value)}
                    />
                    {errors.name ? (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    ) : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">TAN Number</span>
                    <Input
                      value={values.tanNumber}
                      onChange={(event) => updateValue("tanNumber", event.target.value)}
                    />
                    {errors.tanNumber ? (
                      <p className="text-sm text-destructive">{errors.tanNumber}</p>
                    ) : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Institution Head</span>
                    <Input
                      value={values.institutionHead}
                      onChange={(event) => updateValue("institutionHead", event.target.value)}
                    />
                    {errors.institutionHead ? (
                      <p className="text-sm text-destructive">{errors.institutionHead}</p>
                    ) : null}
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium">Address</span>
                    <Input
                      value={values.address}
                      onChange={(event) => updateValue("address", event.target.value)}
                    />
                    {errors.address ? (
                      <p className="text-sm text-destructive">{errors.address}</p>
                    ) : null}
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Username or Email</span>
                    <Input
                      autoComplete="username"
                      value={values.username}
                      onChange={(event) => updateValue("username", event.target.value)}
                    />
                    {errors.username ? (
                      <p className="text-sm text-destructive">{errors.username}</p>
                    ) : null}
                    {!errors.username ? (
                      <p className="text-sm text-muted-foreground">
                        Use either a handle like `greenfield_admin` or a full email address.
                      </p>
                    ) : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Password</span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={values.password}
                      onChange={(event) => updateValue("password", event.target.value)}
                    />
                    {errors.password ? (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    ) : null}
                  </label>
                </div>
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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Institution directory</CardTitle>
          <CardDescription>
            Review created institutions and open a record to reset credentials or deactivate
            login.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Institution Name</th>
                <th className="py-3 pr-4 font-medium">TAN Number</th>
                <th className="py-3 pr-4 font-medium">Institution Head</th>
                <th className="py-3 pr-4 font-medium">Username</th>
                <th className="py-3 pr-4 font-medium">Login Status</th>
                <th className="py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {institutionsQuery.data?.map((institution) => (
                <tr key={institution.id} className="hover:bg-muted/40">
                  <td className="py-3 pr-4 font-medium">
                    <Link className="hover:underline" to={`/institutions/${institution.id}`}>
                      {institution.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{institution.tanNumber}</td>
                  <td className="py-3 pr-4">{institution.institutionHead}</td>
                  <td className="py-3 pr-4">{institution.username ?? "Not set"}</td>
                  <td className="py-3 pr-4">
                    {institution.loginActive ? "Active" : "Inactive"}
                  </td>
                  <td className="py-3">{formatDate(institution.createdAt)}</td>
                </tr>
              ))}
              {institutionsQuery.data?.length === 0 ? (
                <tr>
                  <td className="py-6 text-muted-foreground" colSpan={6}>
                    No institutions have been created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
