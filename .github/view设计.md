高校实验室资源预约系统 - 前端 UI/UX 设计规范指南

1. 概述 (Overview)

本设计规范旨在确保“实验室资源预约与调度管理系统”在后续开发过程中保持视觉风格的一致性。本系统采用现代化 B 端管理后台风格，强调清晰的层级、柔和的阴影以及高效的数据可视化。

设计关键词：Clean (整洁)、Professional (专业)、Indigo/Blue (蓝紫主调)、Card-based (卡片式)。

2. 视觉基础 (Visual Foundation)

2.1 色彩系统 (Color System)

系统主色调采用稳重且具科技感的蓝紫色系，辅助色用于状态表达。

| 颜色名称 | Tailwind 类名 | Hex 参考值 | 使用场景 |
| Primary (主色) | bg-blue-600 | #2563EB | 主按钮、选中状态、关键图标背景 |
| Secondary (次主色) | bg-indigo-600 | #4F46E5 | 数据图表主色、强调文字、AI 功能 |
| Success (成功) | bg-green-100 / text-green-800 | #DCFCE7 / #166534 | “已通过”状态、正向增长趋势 |
| Warning (警告) | bg-amber-50 / text-amber-600 | #FFFBEB / #D97706 | “待审核”状态、提示信息 |
| Danger (危险) | bg-red-100 / text-red-800 | #FEE2E2 / #991B1B | “已拒绝”状态、删除操作 |
| Background (背景) | bg-gray-50 | #F9FAFB | 全局页面背景（非纯白，保护视力） |
| Surface (表面) | bg-white | #FFFFFF | 卡片、侧边栏、弹窗背景 |
| Border (边框) | border-gray-100 | #F3F4F6 | 极淡的边框，用于分隔卡片 |

2.2 字体与排版 (Typography)

字体家族：优先使用系统无衬线字体 (San Francisco, Inter, Roboto, PingFang SC)。

字号层级：

Page Title (H1): 30px (text-3xl), Bold (font-bold) —— 用于欢迎页标题

Card Title (H3): 18px (text-lg), Bold —— 用于卡片标题

Metric Value: 30px (text-3xl), Bold —— 用于仪表盘数字

Body Text: 14px (text-sm) —— 用于表格内容、正文

Label/Caption: 12px (text-xs) —— 用于次要信息、表头

2.3 间距与圆角 (Spacing & Radius)

本系统风格的一大特征是大圆角和通透的留白，避免传统管理后台的生硬感。

圆角 (Radius)：

卡片/容器：16px (rounded-2xl) —— 所有白色底板容器

按钮/输入框：8px (rounded-lg)

标签 (Badge)：999px (rounded-full)

阴影 (Shadow)：

默认卡片：shadow-sm (轻微阴影)

Hover 状态：shadow-md (悬浮时加深，配合 scale-105 动画)

3. 核心组件规范 (Component Specs)

3.1 布局容器 (Layout & Cards)

所有内容块应放置在白色卡片中，卡片之间保持间距。

样式：白色背景 + 极淡边框 + 轻微阴影。

代码参考 (Tailwind)：

.card-container {
  @apply bg-white p-6 rounded-2xl shadow-sm border border-gray-100;
}



Vue/Element 实现建议：

不要直接使用 <el-card> 的默认样式（通常有明显的深边框）。

建议封装一个 <BaseCard> 组件，应用上述 CSS 类。

3.2 导航栏 (Sidebar)

状态：

默认：文字灰色 (text-gray-600)，背景透明。

激活 (Active)：文字主色 (text-blue-700)，背景浅蓝 (bg-blue-50)，图标高亮。

交互：Hover 时背景变浅灰 (hover:bg-gray-50)。

3.3 状态标签 (Status Badges)

统一使用 Pill (药丸) 形状，带边框的浅色背景 + 深色文字。

待审核：bg-yellow-100 + text-yellow-800 + border-yellow-200

已通过：bg-green-100 + text-green-800 + border-green-200

已拒绝：bg-red-100 + text-red-800 + border-red-200

3.3.1 图标规范 (Icons)

统一使用 `lucide-react` 图标组件，配合 Tailwind 控制大小与颜色。

禁止在 UI 中直接使用 Emoji 作为图标（不同系统渲染差异大、风格不统一）。

尺寸 (Size)：

默认列表/按钮内图标：h-4 w-4 或 h-5 w-5

强调图标/列表主图标：h-6 w-6

语义颜色 (Semantic Colors)：

Success：text-green-600（通过/成功）

Warning：text-amber-600（提醒/注意）

Danger：text-red-600（拒绝/错误/冲突）

Info：text-blue-600（系统通知/提示）

Neutral：text-slate-600 / text-gray-600（默认/未知）

通知图标映射建议 (Notification Icons)：

reservation_approved：CircleCheck（text-green-600）

reservation_rejected：CircleX（text-red-600）

reservation_cancelled：Ban（text-gray-600）

reservation_reminder：AlarmClock（text-amber-600）

system：Megaphone（text-blue-600）

default：Mail（text-slate-600）

3.4 按钮 (Buttons)

主按钮 (Primary)：蓝/紫背景 + 白字。Hover 时加深颜色。

AI 特殊按钮：使用紫色系或渐变色，带 Sparkles 图标。

次按钮 (Secondary)：白背景 + 灰边框 + 深灰字。

图标按钮：仅图标，Hover 时出现浅色背景圆形。

3.5 AI 组件 (AI Features)

润色按钮：放置在输入框右上角或右下角，使用 text-purple-600 和 bg-purple-50，体现智能感。

洞察卡片：使用渐变背景 (bg-gradient-to-r from-violet-50 to-indigo-50)，区别于普通数据卡片。

4. 图表规范 (Data Visualization)

图表应保持简洁，移除多余的网格线和边框。

配色序列：

#4F46E5 (Indigo-600) - 主数据

#10B981 (Emerald-500) - 次数据/成功

#F59E0B (Amber-500) - 警告/待处理

#EF4444 (Red-500) - 错误/拒绝

样式要求：

柱状图 (Bar)：圆角柱顶 (radius: [4, 4, 0, 0])。

折线/区域图 (Area)：使用渐变填充 (Gradient Fill)，线条平滑 (type="monotone").

网格线：虚线 (strokeDasharray="3 3"), 仅保留横向线或完全移除。

Tooltip：自定义样式，圆角白色背景，阴影。

5. 开发实现建议 (Implementation Guide)

5.1 若使用 RuoYi-Vue (Element UI)

若依框架默认使用的是 Element UI，其风格偏向传统的企业后台（边框硬朗、字号偏小）。为了达到原型的效果，建议：

引入 Tailwind CSS (推荐)：

在 Vue 项目中安装 Tailwind CSS，直接使用 Utility Classes 来控制布局和圆角，这是最快还原原型的方法。

样式覆盖 (Style Overrides)：

在 App.vue 或 main.scss 中覆盖 Element 变量：

// 增大圆角
$--border-radius-base: 8px;
$--border-radius-small: 4px;
// 修改主色
$--color-primary: #2563EB;
// 卡片去边框化
.el-card {
  border: 1px solid #F3F4F6;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border-radius: 16px;
}



5.2 图标库替换

原型使用了 Lucide React 图标（线性、圆润）。

RuoYi 默认使用 Element Icons 或 FontAwesome。

建议：引入 lucide-vue 或 remixicon，以保持图标风格的现代感，避免使用 Element 默认的实心图标。

5.3 动画效果

页面加载：为主要内容区域添加 Fade In (淡入) 效果。

列表加载：数据加载时使用 Skeleton (骨架屏) 或 Loading Spinner。

交互反馈：按钮点击时应有 Scale (缩放) 或波纹效果。

6. AI 接入规范 (DeepSeek/Gemini)

后端转发：前端严禁直接暴露 API Key。

加载状态：AI 生成过程中，按钮必须进入 disabled 状态，并显示 Loader2 旋转动画，文案变为“生成中...”。

错误处理：若 AI 响应失败，使用 Toast (轻提示) 告知用户，不要阻塞页面。

// 示例：Vue 方法结构
async handleAiPolish() {
  this.loading = true;
  try {
    const res = await callBackendAiApi({ prompt: this.text });
    this.text = res.data;
    this.$message.success('AI 润色完成');
  } catch (err) {
    this.$message.error('AI 服务暂时繁忙');
  } finally {
    this.loading = false;
  }
}

