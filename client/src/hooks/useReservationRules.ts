import { useCallback, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * 预约规则检查 Hook
 * 用于在提交前验证预约是否符合规则
 */
export function useReservationRules() {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [preCheckParams, setPreCheckParams] = useState<{
    labId: number;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  // 获取启用的规则列表
  const { data: enabledRules } = trpc.rule.listEnabled.useQuery();

  // 预检查预约 - 当有参数时执行查询
  const { data: preCheckResult } = trpc.rule.preCheck.useQuery(
    preCheckParams as any,
    {
      enabled: !!preCheckParams,
    }
  );

  /**
   * 检查预约是否符合规则
   */
  const checkReservation = useCallback(
    (labId: number, startTime: Date, endTime: Date) => {
      setIsChecking(true);
      setPreCheckParams({ labId, startTime, endTime });
      // 查询会自动执行，当结果返回时同步错误消息
    },
    []
  );

  // 同步预检查结果到错误消息
  useEffect(() => {
    if (preCheckResult) {
      if (!preCheckResult.valid) {
        setErrorMessage(preCheckResult.reason || "预约不符合规则要求");
      } else {
        setErrorMessage("");
      }
      setIsChecking(false);
    }
  }, [preCheckResult]);

  // 当预检查参数清除时，也清除错误信息
  useEffect(() => {
    if (!preCheckParams) {
      setErrorMessage("");
    }
  }, [preCheckParams]);

  /**
   * 格式化规则为人类可读的文本
   */
  const formatRuleDescription = useCallback(() => {
    if (!enabledRules) return [];

    const descriptions: string[] = [];
    const ruleMap = new Map(enabledRules.map(r => [r.ruleCode, r]));

    // MAX_PER_DAY
    const maxPerDay = ruleMap.get("MAX_PER_DAY");
    if (maxPerDay) {
      descriptions.push(`每日最多预约 ${maxPerDay.ruleValue} 次`);
    }

    // MAX_DURATION
    const maxDuration = ruleMap.get("MAX_DURATION");
    if (maxDuration) {
      descriptions.push(`单次预约最长 ${maxDuration.ruleValue} 小时`);
    }

    // ADVANCE_DAYS
    const advanceDays = ruleMap.get("ADVANCE_DAYS");
    if (advanceDays) {
      descriptions.push(`需提前至少 ${advanceDays.ruleValue} 天预约`);
    }

    return descriptions;
  }, [enabledRules]);

  return {
    checkReservation,
    errorMessage,
    isChecking,
    enabledRules,
    formatRuleDescription,
  };
}
