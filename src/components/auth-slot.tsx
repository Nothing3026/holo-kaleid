import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div
        className="size-9 shrink-0 animate-pulse rounded-full bg-fg/10"
        aria-hidden
      />
    );
  }

  if (user) {
    return (
      <div className="max-w-44 truncate text-fg [&_button]:text-muted [&_button]:hover:text-fg [&_img]:size-8 [&_span]:text-xs">
        <UserButton />
      </div>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium text-fg/80 transition-colors duration-150 hover:bg-fg/10 hover:text-fg"
    >
      サインイン
    </Link>
  );
}
