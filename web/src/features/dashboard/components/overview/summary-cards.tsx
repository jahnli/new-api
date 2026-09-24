import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { StaggerContainer, StaggerItem } from "@/components/page-transition";
import { getUserQuotaDates } from "@/features/dashboard/api";
import { useSummaryCardsConfig } from "@/features/dashboard/hooks/use-dashboard-config";
import type { QuotaDataItem } from "@/features/dashboard/types";
import {
  getPublicPlans,
  getSelfSubscriptionFull,
} from "@/features/subscriptions/api";
import type { SubscriptionPlan } from "@/features/subscriptions/types";
import { useStatus } from "@/hooks/use-status";
import { getCurrencyLabel, isCurrencyDisplayEnabled } from "@/lib/currency";
import dayjs from "@/lib/dayjs";
import { formatDashboardQuota, formatRequestCount } from "@/lib/format";
import { requireServerSuccess } from "@/lib/server-error-message";
import { computeTimeRange } from "@/lib/time";
import { useAuthStore } from "@/stores/auth-store";

import { StatCard } from "../ui/stat-card";
import { SubscriptionSummary } from "./subscription-summary";
import { WalletSummary } from "./wallet-summary";

const SUMMARY_SPARKLINE_BUCKETS = 12;

type SummarySparklineKey = "balance" | "usage" | "requests";

function getBucketIndex(
  timestamp: number,
  start: number,
  end: number,
  bucketCount: number,
): number {
  if (end <= start) return 0;
  const ratio = (timestamp - start) / (end - start);
  return Math.min(
    bucketCount - 1,
    Math.max(0, Math.floor(ratio * bucketCount)),
  );
}

function buildSummarySparklines(
  data: QuotaDataItem[],
  currentBalance: number,
  start: number,
  end: number,
): Record<SummarySparklineKey, number[]> {
  const usage = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0);
  const requests = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0);

  for (const item of data) {
    const timestamp = Number(item.created_at) || start;
    const index = getBucketIndex(
      timestamp,
      start,
      end,
      SUMMARY_SPARKLINE_BUCKETS,
    );
    usage[index] += Number(item.quota) || 0;
    requests[index] += Number(item.count) || 0;
  }

  let balance = currentBalance;
  const balanceTrend = Array.from(
    { length: SUMMARY_SPARKLINE_BUCKETS },
    () => 0,
  );

  for (let index = SUMMARY_SPARKLINE_BUCKETS - 1; index >= 0; index--) {
    balanceTrend[index] = Math.max(0, balance);
    balance += usage[index];
  }

  return {
    balance: balanceTrend,
    usage,
    requests,
  };
}

function getSummarySparkline(
  key: string,
  sparklineData: Record<SummarySparklineKey, number[]>,
): number[] | undefined {
  if (key === "usage") return sparklineData.usage;
  if (key === "requests") return sparklineData.requests;
  return undefined;
}

function calcNextResetTime(
  plan: SubscriptionPlan,
  baseSec: number,
  endSec: number,
): number {
  const period = plan.quota_reset_period;
  if (!period || period === "never") return 0;

  const base = dayjs(baseSec * 1000);
  let next: dayjs.Dayjs;

  switch (period) {
    case "daily":
      next = base.startOf("day").add(1, "day");
      break;
    case "weekly": {
      const weekday = base.day(); // 0=Sun
      const daysUntil = weekday === 0 ? 1 : 8 - weekday;
      next = base.startOf("day").add(daysUntil, "day");
      break;
    }
    case "monthly":
      next = base.startOf("month").add(1, "month");
      break;
    case "custom": {
      const secs = plan.quota_reset_custom_seconds ?? 0;
      if (secs <= 0) return 0;
      next = base.add(secs, "second");
      break;
    }
    default:
      return 0;
  }

  const nextSec = Math.floor(next.valueOf() / 1000);
  if (endSec > 0 && nextSec > endSec) return 0;
  return nextSec;
}

export function SummaryCards() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const { status, loading } = useStatus();

  const summaryTimeRange = useMemo(() => computeTimeRange(1), []);
  const remainQuota = Number(user?.quota ?? 0);
  const usedQuota = Number(user?.used_quota ?? 0);
  const requestCount = Number(user?.request_count ?? 0);

  const usageTrendQuery = useQuery({
    queryKey: [
      "dashboard",
      "overview",
      "summary-sparklines",
      user?.id,
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: summaryTimeRange.start_timestamp,
          end_timestamp: summaryTimeRange.end_timestamp,
          default_time: "hour",
        }),
      ),
    staleTime: 60 * 1000,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["dashboard", "overview", "subscription-self", user?.id],
    queryFn: async () => requireServerSuccess(await getSelfSubscriptionFull()),
    staleTime: 60 * 1000,
  });

  const plansQuery = useQuery({
    queryKey: ["dashboard", "overview", "public-plans", user?.id],
    queryFn: async () => requireServerSuccess(await getPublicPlans()),
    staleTime: 5 * 60 * 1000,
  });

  const planMap = useMemo(() => {
    const map = new Map<number, SubscriptionPlan>();
    for (const record of plansQuery.data?.data ?? []) {
      map.set(record.plan.id, record.plan);
    }
    return map;
  }, [plansQuery.data?.data]);

  const activeSubscriptionRecord = useMemo(() => {
    const subs = subscriptionQuery.data?.data?.subscriptions ?? [];
    if (subs.length === 0) return null;
    return subs[0];
  }, [subscriptionQuery.data?.data?.subscriptions]);
  const activeSub = activeSubscriptionRecord?.subscription ?? null;

  const nextResetTime = useMemo(() => {
    if (!activeSub) return 0;
    if (activeSub.next_reset_time && activeSub.next_reset_time > 0) {
      return activeSub.next_reset_time;
    }
    const plan = planMap.get(activeSub.plan_id);
    if (!plan) return 0;
    const baseSec = activeSub.start_time || summaryTimeRange.end_timestamp;
    return calcNextResetTime(plan, baseSec, activeSub.end_time);
  }, [activeSub, planMap, summaryTimeRange.end_timestamp]);

  const summaryValues = useMemo(() => {
    return {
      usedDisplay: formatDashboardQuota(usedQuota),
      requestCountDisplay: formatRequestCount(requestCount),
    };
  }, [requestCount, usedQuota]);

  const currencyEnabledFromStore = isCurrencyDisplayEnabled();
  const statusCurrencyFlag =
    typeof status?.display_in_currency === "boolean"
      ? Boolean(status.display_in_currency)
      : undefined;
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore;
  const currencyLabel = currencyEnabled ? getCurrencyLabel() : "Tokens";

  const sparklineData = useMemo(
    () =>
      buildSummarySparklines(
        usageTrendQuery.data?.data ?? [],
        remainQuota,
        summaryTimeRange.start_timestamp,
        summaryTimeRange.end_timestamp,
      ),
    [
      remainQuota,
      summaryTimeRange.end_timestamp,
      summaryTimeRange.start_timestamp,
      usageTrendQuery.data?.data,
    ],
  );

  const recentUsage = useMemo(
    () =>
      (usageTrendQuery.data?.data ?? []).reduce(
        (total, item) => total + (Number(item.quota) || 0),
        0,
      ),
    [usageTrendQuery.data?.data],
  );

  const todayUsageDisplay = formatDashboardQuota(recentUsage);

  const items = useSummaryCardsConfig({
    ...summaryValues,
    todayUsageDisplay,
    currencyEnabled,
    currencyLabel,
  }).map((config, index) => {
    const tones = ["accent-1", "accent-2", "accent-3"] as const;

    return {
      key: config.key,
      title: config.title,
      value: config.value,
      desc: config.description,
      icon: config.icon,
      tone: tones[index] ?? "accent-3",
      sparkline:
        config.key === "todayUsage"
          ? sparklineData.usage
          : getSummarySparkline(config.key, sparklineData),
      sparklineVariant: "line" as const,
    };
  });

  const activePlanTitle = activeSub
    ? planMap.get(activeSub.plan_id)?.title
    : undefined;

  return (
    <div className="bg-card overflow-hidden rounded-2xl border shadow-xs">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">
                {t("Usage at a glance")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("Monitor balance, usage, and request volume")}
              </p>
            </div>
          </div>
          <StaggerContainer className="grid gap-3 md:grid-cols-3">
            {items.map((it) => (
              <StaggerItem
                key={it.key}
                className="bg-background/60 rounded-xl border p-3"
              >
                <StatCard
                  title={it.title}
                  value={it.value}
                  description={it.desc}
                  icon={it.icon}
                  tone={it.tone}
                  sparkline={it.sparkline}
                  sparklineVariant={it.sparklineVariant}
                  loading={loading}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-4 border-t bg-[linear-gradient(135deg,color-mix(in_oklch,var(--overview-accent-2)_12%,var(--background))_0%,color-mix(in_oklch,oklch(0.82_0.04_155)_8%,var(--background))_48%,color-mix(in_oklch,var(--overview-accent-1)_7%,var(--background))_100%)] p-4 sm:p-5 xl:border-t-0 xl:border-l">
          {subscriptionQuery.isPending && <LoadingState className="min-h-32" />}
          {subscriptionQuery.isError && !subscriptionQuery.data && (
            <ErrorState
              className="min-h-32 p-0"
              onRetry={() => void subscriptionQuery.refetch()}
            />
          )}
          {activeSub && (
            <SubscriptionSummary
              subscription={activeSub}
              premiumQuota={activeSubscriptionRecord?.premium_quota}
              planTitle={activePlanTitle}
              nextResetTime={nextResetTime}
            />
          )}
          {subscriptionQuery.data && !activeSub && (
            <WalletSummary
              remainQuota={remainQuota}
              recentUsage={recentUsage}
              loading={loading || !user}
              usagePending={usageTrendQuery.isPending}
              usageError={usageTrendQuery.isError}
              onRetry={() => void usageTrendQuery.refetch()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
