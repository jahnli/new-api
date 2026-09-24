import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatPremiumQuota } from "@/features/subscriptions/lib/premium-quota";
import type { UserSubscription } from "@/features/subscriptions/types";
import { toIntlLocale } from "@/i18n/languages";
import dayjs from "@/lib/dayjs";
import { formatNumber } from "@/lib/format";

export function SubscriptionSummary(props: {
  subscription: UserSubscription;
  planTitle?: string;
  nextResetTime: number;
}) {
  const { t, i18n } = useTranslation();
  const total = BigInt(props.subscription.amount_total);
  const used = BigInt(props.subscription.amount_used);
  const isUnlimited = total === 0n;
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language);
  const usedPercent = total > 0n ? Number((used * 10000n) / total) / 100 : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="dark:text-foreground text-sm font-medium text-[#152547]">
          {t("Current Subscription")}
        </span>
        {props.planTitle && (
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary max-w-36 border-0 text-sm"
          >
            <span className="truncate">{props.planTitle}</span>
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-2xl leading-tight font-semibold tracking-tight break-all tabular-nums">
          <span>{formatPremiumQuota(used.toString())}</span>
          <span className="dark:text-foreground text-[#152547]">
            {` / ${isUnlimited ? t("Unlimited") : formatPremiumQuota(total.toString())}`}
          </span>
        </p>
        {!isUnlimited && (
          <Progress
            value={Math.min(100, usedPercent)}
            aria-label={t("Total Quota")}
            aria-valuetext={t("{{percent}}% used", {
              percent: formatNumber(usedPercent, locale),
            })}
            className="dark:[&_[data-slot=progress-track]]:bg-muted [&_[data-slot=progress-indicator]]:bg-[#ff9000] [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-[#eef3ff]"
          />
        )}
      </div>

      {props.nextResetTime > 0 && (
        <div className="dark:text-foreground flex items-center gap-1.5 text-sm text-[#152547]">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("Next reset")}:{" "}
            {dayjs(props.nextResetTime * 1000).format("YYYY/M/D HH:mm:ss")}
          </span>
        </div>
      )}
    </div>
  );
}
