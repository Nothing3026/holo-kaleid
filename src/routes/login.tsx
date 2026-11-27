import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-6 text-fg">
      <div className="login-aura pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative w-full max-w-sm rounded-xl bg-surface p-6 shadow-panel">
        <p className="font-display text-xl font-semibold tracking-tight">
          Holo Kaleid
        </p>
        <p className="mt-1 text-sm text-muted">
          サインインして、万華鏡を続ける。
        </p>
        <div className="mt-6 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p, i) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className={cn(
                  "flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition-[transform,opacity] duration-150 ease-out active:scale-[0.96]",
                  i === 0
                    ? "bg-accent text-accent-fg hover:opacity-90"
                    : "bg-surface-2 text-fg hover:bg-border-strong",
                )}
              >
                {p.label} で続ける
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">サインインは無効です。</p>
          )}
        </div>
        <Link
          to="/"
          className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-surface-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-fg"
        >
          ゲストのまま描く
        </Link>
      </div>
    </main>
  );
}
