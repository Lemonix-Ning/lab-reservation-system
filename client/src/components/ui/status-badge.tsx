import { cn } from "@/lib/utils";

type BadgeVariant = 
  | "pending"    // 待审核 - 黄色
  | "approved"   // 已通过 - 绿色
  | "rejected"   // 已拒绝 - 红色
  | "active"     // 激活/正常 - 蓝色
  | "restricted" // 受限 - 红色
  | "info";      // 信息 - 灰色

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

/**
 * StatusBadge - 符合 view设计.md 规范的状态标签
 * 特点：Pill 形状 + 浅色背景 + 深色文字 + 边框
 */
export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  const variants = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    active: "bg-blue-100 text-blue-800 border-blue-200",
    restricted: "bg-red-100 text-red-800 border-red-200",
    info: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
