import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BaseCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
}

/**
 * BaseCard - 符合 view设计.md 规范的卡片容器
 * 特点：白色背景 + 极淡边框 + 轻微阴影 + 16px 圆角
 */
export function BaseCard({ 
  children, 
  className, 
  title, 
  subtitle,
  headerAction 
}: BaseCardProps) {
  return (
    <div className={cn(
      "bg-white p-6 rounded-2xl shadow-sm border border-gray-100",
      className
    )}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {headerAction && (
            <div>{headerAction}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
