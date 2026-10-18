import { Badge, Tooltip } from "@fluentui/react-components";
import type { Drift } from "../controls/drift";
import { DRIFT_LABEL } from "../controls/drift";
import { StatusBadge, type StatusLevel } from "./common";

const LEVEL: Record<Drift["state"], StatusLevel | null> = {
  in_sync: "good",
  managed: "good",
  pending: "info",
  drifted: "critical",
  diverged: "serious",
  unmanaged: null,
};

/** Live-vs-GitOps state with an icon and a label (never colour alone). */
export function DriftBadge({ drift }: { drift: Drift | undefined }) {
  if (!drift) return <Badge appearance="outline" color="subtle">–</Badge>;
  const level = LEVEL[drift.state];
  return (
    <Tooltip content={drift.summary} relationship="description">
      <span>
        {level ? (
          <StatusBadge level={level}>{DRIFT_LABEL[drift.state]}</StatusBadge>
        ) : (
          <Badge appearance="outline" color="subtle">
            {DRIFT_LABEL[drift.state]}
          </Badge>
        )}
      </span>
    </Tooltip>
  );
}
