import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { IconBadge } from "@/components/ui/icon-badge";
import { Progress } from "@/components/ui/progress";
import { toIntlLocale } from "@/i18n/languages";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatPremiumQuota } from "../lib/premium-quota";
import type { PremiumQuota } from "../premium-api";
import type { UserSubscription } from "../types";
import { SubscriptionPremiumModels } from "./subscription-premium-models";
import { SubscriptionQuotaDetailsPopover } from "./subscription-quota-details-popover";

export function SubscriptionQuotaBreakdown(props: {
  subscription: UserSubscription;
  quota?: PremiumQuota;
}) {
  const { t } = useTranslation();
  const total = BigInt(props.subscription.amount_total);
  const used = BigInt(props.subscription.amount_used);
  const remaining = total > used ? total - used : 0n;
  const quota = props.quota;
  const showPremium = quota?.enabled === true;
  const premiumUsed = quota ? BigInt(quota.premium_amount_used) : 0n;
  const premiumLimit = quota ? BigInt(quota.premium_limit) : 0n;
  const reservationNote = t(
    "Quota usage includes pending request reservations.",
  );
  const formattedUsed = formatPremiumQuota(used.toString());
  const formattedTotal =
    total > 0n ? formatPremiumQuota(total.toString()) : t("Unlimited");
  const formattedRemaining =
    total > 0n ? formatPremiumQuota(remaining.toString()) : t("Unlimited");
  const totalUsedPercent =
    total > 0n ? Number((used * 10000n) / total) / 100 : 0;
  const ringPercent = Math.min(100, Math.max(0, totalUsedPercent));
  let ringColor = "text-emerald-500";
  if (totalUsedPercent >= 80) {
    ringColor = "text-red-500";
  } else if (totalUsedPercent >= 50) {
    ringColor = "text-amber-500";
  }

  return (
    <div className="@container">
      <div
        className={cn(
          "grid items-center gap-6",
          showPremium &&
            "@xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @xl:gap-8",
        )}
      >
        <div className="flex min-w-0 flex-col items-center justify-center gap-3 py-2">
          <div className="relative aspect-square w-44 max-w-full">
            <svg
              viewBox="0 0 200 200"
              className="size-full -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-muted"
              />
              <circle
                cx="100"
                cy="100"
                r="90"
                pathLength="100"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${ringPercent} 100`}
                className={cn(ringColor, ringPercent === 0 && "opacity-0")}
              />
            </svg>
            <div className="absolute inset-7 flex flex-col items-center justify-center gap-1 text-center">
              <span className="text-muted-foreground text-sm">
                {t("Remaining subscription quota")}
              </span>
              <span className="w-full text-2xl font-semibold tracking-tight break-all tabular-nums">
                {formattedRemaining}
              </span>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-base tabular-nums">
            <span className="text-muted-foreground">{t("Used")}</span>
            <span className="font-semibold break-all">{formattedUsed}</span>
            <span className="text-muted-foreground">/</span>
            <span className="sr-only">{t("Total Quota")}</span>
            <span className="font-semibold break-all">{formattedTotal}</span>
            <SubscriptionQuotaDetailsPopover
              title={t("Total Quota")}
              iconClassName="size-4"
              used={formattedUsed}
              limit={formattedTotal}
              remaining={formattedRemaining}
              description={
                showPremium
                  ? t(
                      "Shared by standard and advanced models. Advanced models have an additional quota limit.",
                    )
                  : reservationNote
              }
            />
          </div>
        </div>
        {showPremium && (
          <QuotaUsagePanel
            title={t("Advanced model quota")}
            icon={<Sparkles />}
            allocationPercent={quota.effective_percent}
            used={premiumUsed}
            limit={premiumLimit}
            remaining={BigInt(quota.premium_available)}
            description={t(
              "Advanced model usage counts toward total quota. Available amount is limited by both the advanced quota limit and the remaining subscription quota.",
            )}
            showPremiumModels
          />
        )}
      </div>
      {quota && !quota.enabled && (
        <p className="text-muted-foreground mt-4 text-xs">
          {t("Premium quota limit is disabled")}
        </p>
      )}
    </div>
  );
}

function QuotaUsagePanel(props: {
  title: string;
  icon: ReactNode;
  allocationPercent?: number;
  used: bigint;
  limit: bigint | null;
  remaining: bigint;
  description: string;
  showPremiumModels?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language);
  // Preserve over-allocation percentages in text; only the visual bar is clamped.
  let percent: number | null = null;
  if (props.limit !== null && props.limit > 0n) {
    percent = Number((props.used * 10000n) / props.limit) / 100;
  } else if (props.limit === 0n && props.used === 0n) {
    percent = 0;
  }
  let percentLabel = t("Unlimited");
  if (percent !== null) {
    percentLabel = t("{{percent}}% used", {
      percent: formatNumber(percent, locale),
    });
  } else if (props.limit === 0n) {
    percentLabel = t("Over quota");
  }
  const formattedRemaining =
    props.limit === null
      ? t("Unlimited")
      : formatPremiumQuota(props.remaining.toString());
  const formattedLimit =
    props.limit === null
      ? t("Unlimited")
      : formatPremiumQuota(props.limit.toString());
  const formattedUsed = formatPremiumQuota(props.used.toString());
  let usageColor = {
    text: "text-emerald-500",
    progress: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
  };
  if (props.limit === null) {
    usageColor = { text: "text-muted-foreground", progress: "" };
  } else if (percent === null || percent >= 80) {
    usageColor = {
      text: "text-red-500",
      progress: "[&_[data-slot=progress-indicator]]:bg-red-500",
    };
  } else if (percent >= 50) {
    usageColor = {
      text: "text-amber-500",
      progress: "[&_[data-slot=progress-indicator]]:bg-amber-500",
    };
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3",
        props.showPremiumModels && "bg-primary/5 rounded-xl p-4",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-base font-medium">
          <IconBadge size="sm" tone="primary">
            {props.icon}
          </IconBadge>
          <div className="flex min-w-0 items-center gap-1">
            <span>{props.title}</span>
            <SubscriptionQuotaDetailsPopover
              title={props.title}
              iconClassName="size-4"
              used={formattedUsed}
              limit={formattedLimit}
              remaining={formattedRemaining}
              description={props.description}
            />
          </div>
        </div>
        {props.allocationPercent !== undefined && (
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary h-auto px-2.5 py-1 text-sm tabular-nums"
          >
            {t("Share {{percent}}%", {
              percent: formatNumber(props.allocationPercent, locale),
            })}
          </Badge>
        )}
      </div>
      <div className="space-y-4">
        <p
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 gap-y-1  font-semibold tracking-tight tabular-nums",
            props.showPremiumModels ? "text-xl" : "text-2xl",
          )}
        >
          <span className="text-muted-foreground text-sm font-normal">
            {t("Used")}
          </span>
          <span className={cn("break-all", usageColor.text)}>
            {formattedUsed}
          </span>
          <span className="text-muted-foreground text-base font-normal">/</span>
          <span className="sr-only">{t("Total Quota")}</span>
          <span className="break-all">{formattedLimit}</span>
        </p>
        {props.limit !== null && (
          <Progress
            value={Math.min(100, Math.max(0, percent ?? 100))}
            aria-label={props.title}
            aria-valuetext={percentLabel}
            className={cn(
              "[&_[data-slot=progress-track]]:h-1.5",
              usageColor.progress,
            )}
          />
        )}
      </div>
      {props.showPremiumModels && (
        <div className="space-y-2 border-t border-dashed pt-3">
          <p className="text-sm font-medium">{t("Advanced model list")}</p>
          <SubscriptionPremiumModels />
        </div>
      )}
    </div>
  );
}
