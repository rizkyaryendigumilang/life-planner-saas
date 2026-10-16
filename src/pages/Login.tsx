import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole,
} from "lucide-react";
import { pb } from "../lib/pocketbase";
import { API_BASE } from "../lib/hosts";
import { Input, Label } from "../components/ui";
import { GitHubMark, GoogleMark, TelegramMark } from "../components/brand-icons";
import { toast } from "sonner";
import { BrandLogo } from "../components/BrandLogo";

type AuthMode = "login" | "signup" | "forgot" | "reset";
type OAuthProvider = { name: string; displayName?: string; authURL?: string; pkce?: boolean };
type SocialProvider = "google" | "github" | "telegram";

const SOCIAL_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  github: "GitHub",
  telegram: "Telegram",
};

function readResetToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || params.get("passwordReset") || params.get("resetToken") || params.get("passwordResetToken") || "";
}
/** Lets `?mode=signup` deep-link straight to a card, so pages can link to sign-up. */
function readModeParam(): AuthMode | "" {
  const value = (new URLSearchParams(window.location.search).get("mode") || "").toLowerCase();
  return value === "login" || value === "signup" || value === "forgot" || value === "reset" ? (value as AuthMode) : "";
}
function friendlyError(error: unknown) {
  const e = error as { response?: { message?: string; data?: Record<string, { message?: string }> }; message?: string };
  const msg = e?.response?.message || e?.message || "Something went wrong. Please try again.";
  if (/Failed to authenticate|invalid email or password|doesn't match/i.test(msg)) return "That email and password don't match.";
  if (/network|fetch failed|failed to fetch/i.test(msg)) return "Can't reach the server. Check your connection and PocketBase.";
  if (/already registered|already exists|unique/i.test(msg)) return "That email is already registered. Try signing in instead.";
  return msg;
}

function Mark() {
  return (
    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line/15 bg-surface shadow-xs">
      <BrandLogo variant="mark" size="md" />
    </span>
  );
}

/** Plain bordered card matching the rest of the app — no decorative color. */
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-2xl border border-line/15 bg-surface px-8 py-8">{children}</div>
  );
}

/** Full-width solid action using the app accent (near-black / near-white). */
function PrimaryAction({ children, busy, disabled, type = "submit", onClick }: {
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className="mt-1 flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** One third of the social row: real brand mark above a short label. */
function SocialChoice({ id, label, disabled, busy, onClick }: {
  id: SocialProvider;
  label: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const marks: Record<SocialProvider, React.ReactNode> = {
    google: <GoogleMark size={18} />,
    github: <GitHubMark size={18} />,
    telegram: <TelegramMark size={18} />,
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      title={disabled ? `${label} sign-in is not configured yet` : `Continue with ${label}`}
      className={
        "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-line/15 bg-surface px-2 py-2 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 " +
        (disabled
          ? "text-ink-faint opacity-70"
          : "text-ink-soft hover:border-line/25 hover:bg-muted hover:text-ink")
      }
    >
      <span className="grid h-[18px] place-items-center">{marks[id]}</span>
      <span className="w-full truncate text-center">{label}</span>
    </button>
  );
}

function passwordField(pw: string) {
  if (pw.length < 8) return { label: "Too short", tone: "text-negative" };
  if (pw.length < 10) return { label: "Okay", tone: "text-ink-faint" };
  const varied = /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
  return varied ? { label: "Strong", tone: "text-positive" } : { label: "Good", tone: "text-ink-faint" };
}

export function Login({ onAuthenticated }: { onAuthenticated: () => void }) {
  const initialToken = useMemo(readResetToken, []);
  const [mode, setMode] = useState<AuthMode>(() => (initialToken ? "reset" : readModeParam() || "login"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  // The API reports which social buttons the server can actually complete.
  const [available, setAvailable] = useState<Record<SocialProvider, boolean>>({ google: false, github: false, telegram: false });
  const [resetSent, setResetSent] = useState(false);
  const telegramAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    pb.collection("users").listAuthMethods()
      .then((data: any) => { if (active) setProviders((data?.oauth2?.providers || []) as OAuthProvider[]); })
      .catch(() => { if (active) setProviders([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/auth/providers`)
      .then((response) => response.json())
      .then((data) => { if (active) setAvailable({ google: Boolean(data?.google), github: Boolean(data?.github), telegram: Boolean(data?.telegram) }); })
      .catch(() => { /* keep everything disabled when the API is down */ });
    return () => { active = false; };
  }, []);

  useEffect(() => () => telegramAbort.current?.abort(), []);

  useEffect(() => {
    const token = readResetToken();
    if (token) setMode("reset");
  }, []);

  const google = providers.find((p) => p.name.toLowerCase() === "google");
  const github = providers.find((p) => p.name.toLowerCase() === "github");

  function clearResetQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("passwordReset");
    url.searchParams.delete("resetToken");
    url.searchParams.delete("passwordResetToken");
    url.searchParams.delete("token");
    url.searchParams.delete("mode");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
  function validateActiveUser(record: any) {
    const status = typeof record?.status === "string" ? record.status.toLowerCase() : "";
    if (status !== "active") {
      pb.authStore.clear();
      toast.error(status === "pending" ? "Your account is still waiting for an admin to activate it." : "This account is disabled. Contact an administrator.");
      return false;
    }
    return true;
  }
  async function submitLogin(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const result = await pb.collection("users").authWithPassword(email.trim().toLowerCase(), password);
      if (!validateActiveUser(result.record)) return;
      toast.success("Signed in. Welcome back!");
      onAuthenticated();
    } catch (error) { toast.error(friendlyError(error)); }
    finally { setBusy(false); }
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) { toast.error("Enter your email address."); return; }
    if (password.length < 8) { toast.error("Use a password with at least 8 characters."); return; }

    setBusy(true);
    try {
      // The account is created by the API server, which assigns the role and
      // status itself; the browser never gets to pick those fields.
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Could not create the account.");

      const result = await pb.collection("users").authWithPassword(clean, password);
      if (!validateActiveUser(result.record)) return;
      toast.success("Account created. Welcome to Life Planner!");
      onAuthenticated();
    } catch (error) { toast.error(friendlyError(error)); }
    finally { setBusy(false); }
  }

  async function socialLogin(provider: SocialProvider) {
    const label = SOCIAL_LABELS[provider];
    if (!available[provider]) {
      toast.error(`${label} sign-in isn't configured yet. Ask an admin to add the ${label} client ID and secret.`);
      return;
    }

    if (provider === "telegram") {
      await telegramLogin();
      return;
    }

    const entry = provider === "google" ? google : github;
    if (!entry) {
      toast.error(`PocketBase has no ${label} provider enabled for this collection.`);
      return;
    }

    setBusy(true);
    try {
      const result = await pb.collection("users").authWithOAuth2({ provider: entry.name });
      if (!validateActiveUser(result.record)) return;
      toast.success(`Signed in with ${label}.`);
      onAuthenticated();
    } catch (error) { toast.error(friendlyError(error)); }
    finally { setBusy(false); }
  }

  async function telegramLogin() {
    setBusy(true);
    const controller = new AbortController();
    telegramAbort.current = controller;
    let handshakeOpened = false;

    try {
      const start = await fetch(`${API_BASE}/api/auth/telegram/start`, { method: "POST", signal: controller.signal })
        .then((response) => response.json());
      if (!start?.success) throw new Error(start?.message || "Could not start the Telegram sign-in.");

      const popup = window.open(start.url, "life-planner-telegram", "width=460,height=680");
      if (!popup) {
        // Pop-up blocked: hand the user the link so the flow can continue.
        window.prompt("Open this Telegram link to continue:", start.url);
      }
      handshakeOpened = true;
      toast.info("Press Start in Telegram to finish signing in.");

      const deadline = Number(start.expiresAt) || Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (controller.signal.aborted) return;

        const poll = await fetch(`${API_BASE}/api/auth/telegram/poll?code=${encodeURIComponent(start.code)}`, { signal: controller.signal })
          .then((response) => response.json())
          .catch(() => null);
        if (!poll) continue;

        if (poll.status === "expired") throw new Error("The Telegram sign-in expired. Please try again.");
        if (poll.status !== "ok") continue;

        pb.authStore.save(poll.token, poll.record);
        if (!validateActiveUser(poll.record)) return;
        toast.success("Signed in with Telegram.");
        onAuthenticated();
        return;
      }

      throw new Error("The Telegram sign-in timed out. Please try again.");
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error(friendlyError(error));
    } finally {
      if (handshakeOpened) telegramAbort.current = null;
      setBusy(false);
    }
  }

  async function requestReset(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await pb.collection("users").requestPasswordReset(email.trim().toLowerCase());
    } catch {
      // Keep the UI response generic to avoid exposing whether an account exists.
    } finally {
      setResetSent(true);
      toast.success("If that email is registered, a reset link is on the way.");
      setBusy(false);
    }
  }
  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    const token = readResetToken();
    if (!token) { toast.error("Reset token not found. Request a new link."); return; }
    if (nextPassword.length < 10) { toast.error("Use a password with at least 10 characters."); return; }
    if (nextPassword !== confirmPassword) { toast.error("The passwords don't match."); return; }
    setBusy(true);
    try {
      await pb.collection("users").confirmPasswordReset(token, nextPassword, confirmPassword);
      clearResetQuery(); setPassword(""); setNextPassword(""); setConfirmPassword(""); setMode("login");
      toast.success("Password updated. Please sign in.");
    } catch (error) { toast.error(friendlyError(error)); }
    finally { setBusy(false); }
  }

  const strength = passwordField(password);
  const isSignup = mode === "signup";

  function switchMode(next: AuthMode) {
    if (next === mode) return;
    telegramAbort.current?.abort();
    setPassword("");
    setShowPassword(false);
    setMode(next);
    // Keep the URL in step with the visible card so a reload lands in the same place.
    const url = new URL(window.location.href);
    if (next === "login") url.searchParams.delete("mode");
    else url.searchParams.set("mode", next);
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  const socialButtons = (
    <div className="grid grid-cols-3 gap-2">
      {(["google", "github", "telegram"] as SocialProvider[]).map((id) => (
        <SocialChoice
          key={id}
          id={id}
          label={SOCIAL_LABELS[id]}
          disabled={!available[id]}
          busy={busy}
          onClick={() => void socialLogin(id)}
        />
      ))}
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 text-ink sm:px-5 sm:py-14">
      <div className="w-full max-w-[380px] animate-rise">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo variant="full" size="md" />
          <p className="mt-3 text-xs text-ink-faint">Smart Personal Life & Finance Workspace</p>
        </div>

        {mode === "login" && (
          <>
            <AuthCard>
              <h1 className="text-center text-[26px] font-semibold tracking-[-.03em] text-ink">Sign-in</h1>
              <p className="mt-1.5 text-center text-sm leading-6 text-ink-soft">Welcome back to your workspace.</p>

              <form onSubmit={submitLogin} className="mt-7 space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="mb-0">Password</Label>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs font-medium text-ink-soft transition hover:text-ink"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-11"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition hover:text-ink"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <PrimaryAction busy={busy}>{busy ? "Signing in…" : "Sign in"}</PrimaryAction>
              </form>

              <p className="mt-5 text-center text-xs text-ink-soft">
                Don't have an account?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="font-medium text-ink underline-offset-2 transition hover:underline">
                  Sign up
                </button>
              </p>
            </AuthCard>

            <div className="mt-5">{socialButtons}</div>

            <p className="mt-7 text-center text-[11px] leading-5 text-ink-faint">
              Signing in keeps this workspace, and everything inside it, private to you.
            </p>
          </>
        )}

        {isSignup && (
          <>
            <AuthCard>
              <h1 className="text-center text-[26px] font-semibold tracking-[-.03em] text-ink">Sign Up</h1>

              <form onSubmit={submitSignup} className="mt-7 space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="mb-0">Password</Label>
                    <span className={`text-[11px] font-medium ${password ? strength.tone : "text-ink-faint"}`}>
                      {password ? strength.label : "8+ characters"}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-11"
                      placeholder="Create a password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition hover:text-ink"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <PrimaryAction busy={busy}>{busy ? "Creating account…" : "Sign Up"}</PrimaryAction>
              </form>

              <p className="mt-5 text-center text-xs text-ink-soft">
                Have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} className="font-medium text-ink underline-offset-2 transition hover:underline">
                  Sign in
                </button>
              </p>
            </AuthCard>

            <div className="mt-5">{socialButtons}</div>

            <p className="mt-7 text-center text-[11px] leading-5 text-ink-faint">
              By continuing you agree to keep this workspace for personal use and to the Terms &amp; Privacy Policy.
            </p>
          </>
        )}

        {mode === "forgot" && (
          <>
            <AuthCard>
              <h1 className="text-center text-[26px] font-semibold tracking-[-.03em] text-ink">Reset password</h1>
              <p className="mt-1.5 text-center text-sm leading-6 text-ink-soft">We'll email you a secure reset link.</p>

              <form onSubmit={requestReset} className="mt-7 space-y-4">
                {resetSent ? (
                  <div className="rounded-lg border border-line/10 bg-muted p-4">
                    <div className="flex items-center gap-2 text-ink">
                      <CheckCircle2 size={16} />
                      <p className="text-sm font-medium">Check your inbox</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-soft">
                      If an account is registered for that email, a reset link will arrive shortly. Remember to check spam.
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                )}

                {resetSent ? (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="mt-1 flex min-h-11 w-full items-center justify-center rounded-lg border border-line/15 bg-surface px-4 text-sm font-medium text-ink transition hover:bg-muted"
                  >
                    Back to sign-in
                  </button>
                ) : (
                  <PrimaryAction busy={busy}>{busy ? "Sending…" : "Send reset link"}</PrimaryAction>
                )}
              </form>
            </AuthCard>

            <button
              onClick={() => switchMode("login")}
              className="mx-auto mt-6 flex items-center gap-2 text-xs font-medium text-ink-soft transition hover:text-ink"
            >
              <ArrowLeft size={14} /> Back to sign-in
            </button>
          </>
        )}

        {mode === "reset" && (
          <>
            <AuthCard>
              <h1 className="text-center text-[26px] font-semibold tracking-[-.03em] text-ink">New password</h1>
              <p className="mt-1.5 text-center text-sm leading-6 text-ink-soft">Choose a unique password, at least 10 characters.</p>

              {!readResetToken() ? (
                <div className="mt-7 rounded-lg border border-line/10 bg-muted p-4 text-xs leading-6 text-ink-soft">
                  <div className="flex items-center gap-2 text-ink">
                    <KeyRound size={15} />
                    <p className="text-sm font-medium">Link is invalid</p>
                  </div>
                  <p className="mt-2">This reset link is missing or has already been used. Request a new one.</p>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="mt-4 flex min-h-10 w-full items-center justify-center rounded-lg border border-line/15 bg-surface px-4 text-sm font-medium text-ink transition hover:bg-muted"
                  >
                    Request a new link
                  </button>
                </div>
              ) : (
                <form onSubmit={confirmReset} className="mt-7 space-y-4">
                  <div>
                    <Label>New password</Label>
                    <Input
                      type="password"
                      value={nextPassword}
                      onChange={(e) => setNextPassword(e.target.value)}
                      minLength={10}
                      autoComplete="new-password"
                      required
                      placeholder="At least 10 characters"
                    />
                  </div>
                  <div>
                    <Label>Confirm password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={10}
                      autoComplete="new-password"
                      required
                      placeholder="Enter it again"
                    />
                  </div>
                  <PrimaryAction busy={busy}>{busy ? "Updating…" : "Update password"}</PrimaryAction>
                </form>
              )}
            </AuthCard>

            <button
              onClick={() => { clearResetQuery(); switchMode("login"); }}
              className="mx-auto mt-6 flex items-center gap-2 text-xs font-medium text-ink-soft transition hover:text-ink"
            >
              <ArrowLeft size={14} /> Back to sign-in
            </button>
          </>
        )}

        <p className="mt-7 flex items-center justify-center gap-1.5 text-center text-[10px] leading-5 text-ink-faint">
          <LockKeyhole size={12} />
          Your data stays private to your workspace.
        </p>
      </div>
    </main>
  );
}