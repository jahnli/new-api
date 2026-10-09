import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DepartmentLogsSection } from "./user-logs-section";

interface DepartmentLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  departmentId: string | null;
  departmentName: string;
  initialStartTimestamp: number;
  initialEndTimestamp: number;
}

export function DepartmentLogsDialog(props: DepartmentLogsDialogProps) {
  const { t } = useTranslation();

  if (!props.departmentId) return null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[min(1360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[calc(100vw-2rem)]">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {t("Usage Logs")} - {props.departmentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2 pr-1">
          <DepartmentLogsSection
            companyId={props.companyId}
            departmentId={props.departmentId}
            startTimestamp={props.initialStartTimestamp}
            endTimestamp={props.initialEndTimestamp}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
