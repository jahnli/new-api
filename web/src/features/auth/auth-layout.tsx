import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/theme-provider";
import { useSystemConfig } from "@/hooks/use-system-config";

import { LoginAurora } from "./components/login-aurora";

import "./components/login-aurora.css";

type AuthLayoutProps = {
  children: React.ReactNode;
  animatedBackground?: boolean;
};

export function AuthLayout({
  children,
  animatedBackground = false,
}: AuthLayoutProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { systemName, logo, loading } = useSystemConfig();

  return (
    <div className="relative isolate grid min-h-svh max-w-none">
      {animatedBackground && <LoginAurora isDark={resolvedTheme === "dark"} />}
      <Link
        to="/"
        className="absolute top-4 left-4 z-10 flex items-center gap-2 transition-opacity hover:opacity-80 sm:top-8 sm:left-8"
      >
        <div className="relative h-8 w-8">
          {loading ? (
            <Skeleton className="absolute inset-0 rounded-full" />
          ) : (
            <img
              src={logo}
              alt={t("Logo")}
              className="h-8 w-8 rounded-full object-cover"
            />
          )}
        </div>
        {loading ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <h1 className="text-xl font-medium">{systemName}</h1>
        )}
      </Link>
      <div className="container flex items-center pt-16 sm:pt-0">
        <div className="mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
