import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { authRequired, missingAuthSettings, safeNext } from "@/lib/auth-config";
import { currentUserEmail } from "@/lib/require-user";

const ERRORS: Record<string, string> = {
  AccessDenied: "That Google account isn't allowed to open these books. Sign in with the owner's account.",
  Configuration: "Sign-in isn't set up correctly on the server.",
};

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (!authRequired() || (await currentUserEmail())) redirect(next);
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? "Sign-in didn't work. Try again.") : null;
  const missing = missingAuthSettings();

  return (
    <div className="mx-auto mt-[12vh] max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Simple Ledger</CardTitle>
          <CardDescription>Sign in to open your books.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          {missing.length > 0 ? (
            <Alert variant="destructive">Sign-in isn&apos;t set up yet. Missing settings: {missing.join(", ")}.</Alert>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: next });
              }}
            >
              <Button type="submit" className="w-full">
                Sign in with Google
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
