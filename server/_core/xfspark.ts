/**
 * 讯飞星火 AI HTTP 客户端
 * 
 * 使用 HTTP 协议 + APIPassword 认证（而非 WebSocket + HMAC 签名）
 * 
 * 环境变量:
 * - XFYUN_API_PASSWORD: 从控制台获取的 APIPassword
 * 
 * 模型选项:
 * - lite: 轻量级，免费
 * - generalv3: Spark Pro，专业级
 * - generalv3.5: Spark Max，旗舰级
 * - 4.0Ultra: Spark 4.0 Ultra，最强大
 */

const API_URL = "https://spark-api-open.xf-yun.com/v1/chat/completions";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  code: number;
  message: string;
  sid: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatCompletionError {
  error: {
    message: string;
    type: string;
    code?: number;
  };
}

export type SparkModel = "lite" | "generalv3" | "generalv3.5" | "4.0Ultra";

class XFSparkService {
  private apiPassword: string;
  private model: SparkModel;
  private isMock: boolean = false;
  private cache: Map<string, { text: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1 * 60 * 60 * 1000; // 1小时缓存

  constructor() {
    this.apiPassword = process.env.XFYUN_API_PASSWORD || "";
    this.model = (process.env.XFYUN_MODEL as SparkModel) || "lite";

    if (!this.apiPassword) {
      console.warn("[XFSpark] ⚠️ XFYUN_API_PASSWORD 未配置，将使用 Mock 模式");
      this.isMock = true;
    } else {
      console.log(`[XFSpark] ✅ 已配置 HTTP 客户端，模型: ${this.model}`);
    }
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(input: string): string {
    return Buffer.from(input).toString('base64');
  }

  /**
   * 检查缓存
   */
  private getCache(input: string): string | null {
    const key = this.getCacheKey(input);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[XFSpark] 📦 缓存命中`);
      return cached.text;
    }
    
    // 清理过期缓存
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(input: string, text: string): void {
    const key = this.getCacheKey(input);
    this.cache.set(key, { text, timestamp: Date.now() });
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: Message[]): Promise<string> {
    if (this.isMock) {
      return this.mockResponse(messages);
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiPassword}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText) as ChatCompletionError;
          errorMessage = errorJson.error?.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        
        console.error(`[XFSpark] ❌ API 错误: ${errorMessage}`);
        
        // 特定错误处理
        if (response.status === 401) {
          throw new Error("APIPassword 无效或已过期，请检查配置");
        }
        if (response.status === 500 && errorMessage.includes("no category route")) {
          throw new Error(`模型参数错误: ${this.model}，请使用 lite/generalv3/generalv3.5/4.0Ultra`);
        }
        
        throw new Error(`讯飞星火 API 错误: ${errorMessage}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      
      if (data.code !== 0) {
        throw new Error(`API 返回错误码 ${data.code}: ${data.message}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("API 返回内容为空");
      }

      console.log(`[XFSpark] ✅ 响应成功，tokens: ${data.usage?.total_tokens || "N/A"}`);
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`未知错误: ${String(error)}`);
    }
  }

  /**
   * 生成预约理由（AI 润色）
   */
  async generateReason(userInput: string, labName: string): Promise<string> {
    const cacheKey = `reason:${labName}:${userInput}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const messages: Message[] = [
      {
        role: "system",
        content: `你是预约助手。用户要预约"${labName}"实验室。
请优化预约理由，要求：
1. 保留原意
2. 50-100字
3. 直接输出结果`,
      },
      {
        role: "user",
        content: userInput || "进行实验研究",
      },
    ];

    const result = await this.chat(messages);
    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * 生成管理洞察报告
   */
  async generateInsight(stats: {
    totalReservations: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    topLabs: { name: string; count: number }[];
    weeklyTrend: { date: string; count: number }[];
  }): Promise<string> {
    const cacheKey = `insight:${JSON.stringify(stats)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const messages: Message[] = [
      {
        role: "system",
        content: `你是管理分析师。基于预约数据生成分析报告。
要求：
1. 分析趋势和问题
2. 200字以内
3. Markdown格式`,
      },
      {
        role: "user",
        content: `数据：总数${stats.totalReservations}，待审${stats.pendingCount}，已批${stats.approvedCount}，已拒${stats.rejectedCount}，热门实验室：${stats.topLabs.map((l) => `${l.name}(${l.count})`).join("、")}`,
      },
    ];

    const result = await this.chat(messages);
    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Mock 响应（用于未配置 APIPassword 时）
   */
  private mockResponse(messages: Message[]): string {
    const lastMessage = messages[messages.length - 1]?.content || "";
    
    // 判断是润色理由还是生成报告
    if (messages[0]?.content?.includes("预约理由")) {
      return `基于学术研究需要，本人计划使用该实验室进行${lastMessage || "相关实验"}。实验内容涉及课程项目研究，预计需要使用实验室的专业设备进行数据采集与分析工作。`;
    }
    
    if (messages[0]?.content?.includes("管理洞察")) {
      return `## 📊 实验室预约洞察报告

### 关键发现
- 预约量整体平稳，待审核数量适中
- 热门实验室集中度较高，建议关注资源分配

### 建议措施
1. 优化热门时段预约流程
2. 考虑增加高需求实验室的开放时间
3. 建立预约提醒机制，减少爽约率

*本报告由 AI 自动生成 (Mock 模式)*`;
    }

    return "这是一条 Mock 响应。请配置 XFYUN_API_PASSWORD 以使用真实 AI 服务。";
  }
}

// 导出单例
export const xfspark = new XFSparkService();
