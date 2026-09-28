import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/error-state";
import { MultiSelect } from "@/components/multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toIntlLocale } from "@/i18n/languages";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  getNotificationAudience,
  notificationKeys,
  sendNotification,
} from "../api";
import {
  formatNotificationTitle,
  missingNotificationImages,
  splitRecipients,
} from "../lib/message";
import { NOTIFICATION_TITLE_THEME_CLASSES } from "../lib/title-theme";
import type { NotificationMessage } from "../types";
import { MessageContent } from "./message-content";

const FEISHU_TEST_RECIPIENTS = [
  { name: "李佳衡", openId: "ou_45d80e11120e18382da7bd7764f3b0ec" },
  { name: "李敬铮", openId: "ou_0f257101142bfca0060c4989f76495e5" },
] as const;

const FEISHU_TEST_RECIPIENT_OPTIONS = FEISHU_TEST_RECIPIENTS.map(
  (recipient) => ({
    label: recipient.name,
    value: recipient.openId,
    hint: recipient.openId,
  }),
);

export function SendDialog(props: {
  message: NotificationMessage;
  test: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language);
  const client = useQueryClient();
  const [testRecipients, setTestRecipients] = useState("");
  const testRecipientIDs = splitRecipients(testRecipients);
  const [recipientError, setRecipientError] = useState("");
  const allUsers = !props.test && props.message.channel !== "email";
  const audience = useQuery({
    queryKey: notificationKeys.audience(
      props.message.channel,
      props.message.company_id,
    ),
    queryFn: () =>
      getNotificationAudience(props.message.channel, props.message.company_id),
    enabled: allUsers,
  });
  let testLabel = t("Feishu Open IDs");
  if (props.message.channel === "dingtalk") testLabel = t("DingTalk User IDs");
  if (props.message.channel === "email") testLabel = t("Email addresses");
  let confirmationDescription: string | undefined;
  if (!props.test) {
    confirmationDescription = allUsers
      ? t(
          "This notification will be sent to all users with a valid Open ID, regardless of company. Review the audience and message before sending.",
        )
      : t(
          "Only the recipients listed below will receive this message. Check the content and recipients before continuing.",
        );
  }
  const missingImages = missingNotificationImages(props.message);
  const mutation = useMutation({
    retry: false,
    mutationFn: (recipients: string[]) => {
      if (missingImages.length) {
        throw new Error(
          `${t("Notification images")}: ${t("Content not found.")}`,
        );
      }
      return sendNotification({ ...props.message, recipients }, props.test);
    },
    onSuccess: (record) => {
      void client.invalidateQueries({ queryKey: notificationKeys.records });
      if (record.status === "success") {
        toast.success(t("Notification sent"));
        props.onSent();
      } else {
        const summary = t(
          "Sent: {{sent}}; failed: {{failed}}; unconfirmed: {{unknown}}",
          {
            sent: formatNumber(record.success_count, locale),
            failed: formatNumber(record.failed_count, locale),
            unknown: formatNumber(record.unknown_count, locale),
          },
        );
        const reason = record.deliveries?.find(
          (delivery) => delivery.status === "failed",
        )?.error;
        const title =
          record.unknown_count > 0
            ? t(
                "Delivery could not be confirmed. Check recipients before resending.",
              )
            : t("Notification failed");
        toast.error(title, {
          description: [summary, reason].filter(Boolean).join("\n"),
          duration: 10000,
        });
        props.onClose();
      }
    },
  });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose();
      }}
      title={
        props.test ? (
          <span className="flex flex-wrap items-center gap-3">
            <span>{t("Test notification")}</span>
            <Label
              htmlFor="notification-test-recipients"
              className="text-muted-foreground select-text"
            >
              {testLabel}
            </Label>
          </span>
        ) : (
          t("Confirm official send")
        )
      }
      desc={confirmationDescription}
      confirmText={mutation.isPending ? t("Sending...") : t("Send")}
      disabled={
        missingImages.length > 0 ||
        (props.test &&
          (testRecipientIDs.length === 0 || testRecipientIDs.length > 20)) ||
        (allUsers &&
          (audience.isFetching ||
            !audience.data ||
            audience.isError ||
            audience.data.recipient_count === 0))
      }
      isLoading={mutation.isPending}
      handleConfirm={() => {
        const recipients = props.test
          ? testRecipientIDs
          : props.message.recipients;
        if (!allUsers && recipients.length === 0) {
          setRecipientError(t("Please enter at least one recipient"));
          return;
        }
        if (props.test && recipients.length > 20) {
          setRecipientError(t("Test sends support up to 20 recipients."));
          return;
        }
        if (
          props.message.channel === "email" &&
          recipients.some(
            (recipient) => !z.email().safeParse(recipient).success,
          )
        ) {
          setRecipientError(t("Please enter valid email addresses"));
          return;
        }
        if (
          props.message.channel !== "email" &&
          recipients.some(
            (recipient) =>
              !/^[A-Za-z0-9_.:@=-]{1,320}$/.test(recipient) ||
              recipient.replace(/^@/, "").toLowerCase() === "all" ||
              recipient === "0",
          )
        ) {
          setRecipientError(t("Invalid IDs"));
          return;
        }
        setRecipientError("");
        mutation.mutate(allUsers ? [] : recipients);
      }}
      className={
        props.test
          ? "flex h-[80dvh] w-[75vw] flex-col overflow-hidden data-[size=default]:max-w-none data-[size=default]:sm:max-w-none [&>[data-slot=alert-dialog-footer]]:shrink-0 [&>[data-slot=alert-dialog-header]]:shrink-0"
          : "sm:max-w-2xl"
      }
    >
      <div
        className={
          props.test
            ? "min-h-0 min-w-0 flex-1 space-y-4 overflow-auto overscroll-contain md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:grid-rows-[minmax(0,1fr)] md:gap-4 md:space-y-0 md:overflow-hidden"
            : "max-h-[50vh] space-y-4 overflow-auto"
        }
      >
        <div
          className={
            props.test
              ? "min-h-0 min-w-0 space-y-4 md:overflow-auto md:overscroll-contain"
              : "space-y-4"
          }
        >
          {!props.test && (
            <div className="flex gap-2">
              <Badge variant="outline">{props.message.channel}</Badge>
              {allUsers && <Badge variant="secondary">{t("All users")}</Badge>}
              {!allUsers && (
                <Badge variant="secondary">
                  {t("Recipients")}:{" "}
                  {formatNumber(props.message.recipients.length, locale)}
                </Badge>
              )}
            </div>
          )}
          {props.test && (
            <div className="border-primary/15 bg-primary/5 space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                {props.message.channel === "feishu" && (
                  <div className="flex gap-2">
                    {FEISHU_TEST_RECIPIENTS.map((recipient) => {
                      const selected = testRecipientIDs.includes(
                        recipient.openId,
                      );
                      return (
                        <Button
                          key={recipient.openId}
                          type="button"
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          aria-pressed={selected}
                          title={recipient.openId}
                          disabled={
                            mutation.isPending ||
                            (!selected && testRecipientIDs.length >= 20)
                          }
                          onClick={() => {
                            setTestRecipients((current) => {
                              const identifiers = splitRecipients(current);
                              if (identifiers.includes(recipient.openId)) {
                                return identifiers
                                  .filter((id) => id !== recipient.openId)
                                  .join("\n");
                              }
                              if (identifiers.length >= 20) return current;
                              return [...identifiers, recipient.openId].join(
                                "\n",
                              );
                            });
                            setRecipientError("");
                          }}
                        >
                          {recipient.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
                <Badge variant="secondary" className="ml-auto shrink-0">
                  {formatNumber(testRecipientIDs.length, locale)} /{" "}
                  {formatNumber(20, locale)}
                </Badge>
              </div>
              {props.message.channel === "feishu" ? (
                <MultiSelect
                  id="notification-test-recipients"
                  options={FEISHU_TEST_RECIPIENT_OPTIONS}
                  selected={testRecipientIDs}
                  allowCreate
                  disabled={mutation.isPending}
                  placeholder={t("Feishu Open IDs")}
                  inputAriaLabel={testLabel}
                  className="bg-background min-h-12"
                  onChange={(values) => {
                    setTestRecipients(
                      splitRecipients(values.join("\n")).join("\n"),
                    );
                    setRecipientError("");
                  }}
                />
              ) : (
                <Textarea
                  id="notification-test-recipients"
                  value={testRecipients}
                  onChange={(event) => {
                    setTestRecipients(event.target.value);
                    setRecipientError("");
                  }}
                  disabled={mutation.isPending}
                  aria-invalid={Boolean(recipientError)}
                  aria-describedby={
                    recipientError
                      ? "notification-test-help notification-recipient-error"
                      : "notification-test-help"
                  }
                  className="bg-background min-h-40 resize-y font-mono text-sm"
                  placeholder={t(
                    "Enter test recipients, separated by commas or new lines.",
                  )}
                />
              )}
              <p
                id="notification-test-help"
                className="text-muted-foreground text-xs"
              >
                {t(
                  "Tests are sent only to the recipients entered here, up to 20. The official audience is never used.",
                )}
              </p>
              {testRecipientIDs.length > 20 && (
                <p role="alert" className="text-destructive text-xs">
                  {t("Test sends support up to 20 recipients.")}
                </p>
              )}
            </div>
          )}
          {recipientError && (
            <p
              id="notification-recipient-error"
              role="alert"
              className="text-destructive text-sm"
            >
              {recipientError}
            </p>
          )}
          {allUsers && (
            <div className="bg-muted/40 space-y-3 rounded-lg p-4 text-sm">
              {audience.isPending && <Spinner />}
              {audience.isError && (
                <ErrorState onRetry={() => void audience.refetch()} />
              )}
              {audience.data && (
                <>
                  <p className="font-medium">
                    {t("Recipients")}:{" "}
                    {formatNumber(audience.data.recipient_count, locale)}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">
                        {t("Total users")}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatNumber(audience.data.total_users, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {t("Missing IDs")}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatNumber(audience.data.missing_ids, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {t("Invalid IDs")}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatNumber(audience.data.invalid_ids, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {t("Duplicate IDs")}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatNumber(audience.data.duplicate_ids, locale)}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-muted-foreground text-xs">
                    {t(
                      "Blank or invalid IDs are skipped and duplicate IDs receive one message. The final audience is determined when you send.",
                    )}
                  </p>
                  {audience.data.recipient_count === 0 && (
                    <p role="alert" className="text-destructive text-xs">
                      {t("No users have a valid recipient ID.")}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {!props.test && !allUsers && (
            <p className="bg-muted/40 rounded-lg p-3 font-mono text-xs break-all">
              {props.message.recipients.join(", ")}
            </p>
          )}
        </div>
        <div
          className={
            props.test
              ? "min-w-0 rounded-lg border p-4 [overflow-wrap:anywhere] md:min-h-0 md:overflow-auto md:overscroll-contain [&_img]:max-w-full"
              : "rounded-lg border p-4"
          }
        >
          <h3
            className={cn(
              "mb-3 font-semibold",
              props.message.channel === "feishu" && [
                "-mx-4 -mt-4 rounded-t-lg p-4",
                NOTIFICATION_TITLE_THEME_CLASSES[
                  props.message.title_theme ?? "blue"
                ],
              ],
            )}
          >
            {formatNotificationTitle(props.message)}
          </h3>
          <MessageContent message={props.message} />
          {missingImages.length > 0 && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {t("Notification images")}: {t("Content not found.")}
            </p>
          )}
        </div>
      </div>
    </ConfirmDialog>
  );
}
