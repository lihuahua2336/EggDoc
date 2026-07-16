import { CircleAlert, Info, Lightbulb, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type CalloutVariant = "note" | "tip" | "warning";

interface CalloutProps {
  children: ReactNode;
  variant: CalloutVariant;
}

const calloutDetails: Record<CalloutVariant, { icon: LucideIcon; label: string }> = {
  note: { icon: Info, label: "Note" },
  tip: { icon: Lightbulb, label: "Tip" },
  warning: { icon: CircleAlert, label: "Warning" },
};

function Callout({ children, variant }: CalloutProps) {
  const { icon: Icon, label } = calloutDetails[variant];

  return (
    <aside className="article-callout" data-callout={variant} role="note" aria-label={label}>
      <div className="article-callout-label" data-callout-label>
        <Icon aria-hidden="true" size={18} strokeWidth={2} />
        <span>{label}</span>
      </div>
      <div className="article-callout-content">{children}</div>
    </aside>
  );
}

export function Note({ children }: Pick<CalloutProps, "children">) {
  return <Callout variant="note">{children}</Callout>;
}

export function Tip({ children }: Pick<CalloutProps, "children">) {
  return <Callout variant="tip">{children}</Callout>;
}

export function Warning({ children }: Pick<CalloutProps, "children">) {
  return <Callout variant="warning">{children}</Callout>;
}
