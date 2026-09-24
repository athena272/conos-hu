import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
};

export function PageHeader({ title, description, icon: Icon }: PageHeaderProps) {
  return (
    <div className="page-header">
      {Icon ? (
        <span className="page-header-icon" aria-hidden>
          <Icon size={22} strokeWidth={1.9} />
        </span>
      ) : null}
      <div className="page-header-body">
        <h2>{title}</h2>
        {description ? (
          <div className="page-header-description">{description}</div>
        ) : null}
      </div>
    </div>
  );
}
