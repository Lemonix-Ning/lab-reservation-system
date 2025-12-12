/**
 * 导出数据为 CSV 格式
 * @param data 要导出的数据
 * @param filename 文件名
 */
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // 获取所有键
  const keys = Object.keys(data[0]);
  
  // 构建 CSV 头
  const headers = keys.join(',');
  
  // 构建 CSV 行
  const rows = data.map(item =>
    keys.map(key => {
      const value = item[key];
      // 如果值包含逗号、引号或换行符，需要用引号括起来
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  // 合并头和行
  const csv = [headers, ...rows].join('\n');
  
  // 添加 BOM 以支持中文
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  
  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出日历事件为 iCalendar (.ics) 格式
 * @param events 要导出的事件数组
 * @param filename 文件名（不含扩展名）
 */
export function exportToICalendar(
  events: Array<{
    id: number;
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    location?: string;
    status?: string;
  }>,
  filename: string = 'calendar'
) {
  if (events.length === 0) {
    console.warn('No events to export');
    return;
  }

  // iCalendar 文件头
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lab Reservation System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ''
  ].join('\r\n');

  // 格式化日期为 iCalendar 格式 (YYYYMMDDTHHMMSSZ)
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  // 转义文本（iCalendar 规范要求）
  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  };

  // 为每个事件生成 VEVENT
  events.forEach((event) => {
    const startDate = formatDate(event.startTime);
    const endDate = formatDate(event.endTime);
    const uid = `reservation-${event.id}@lab-reservation-system`;
    const summary = escapeText(event.title);
    const description = event.description 
      ? escapeText(event.description)
      : `预约ID: ${event.id}${event.status ? `\n状态: ${event.status}` : ''}`;
    const location = event.location ? escapeText(event.location) : '';

    // 生成事件状态（STATUS）
    let status = 'CONFIRMED';
    if (event.status === 'pending') {
      status = 'TENTATIVE';
    } else if (event.status === 'cancelled' || event.status === 'rejected') {
      status = 'CANCELLED';
    }

    icsContent += [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${summary}`,
      description ? `DESCRIPTION:${description}` : '',
      location ? `LOCATION:${location}` : '',
      `STATUS:${status}`,
      `DTSTAMP:${formatDate(new Date())}`, // 创建时间戳
      'END:VEVENT',
      ''
    ].filter(line => line !== '').join('\r\n');
  });

  // iCalendar 文件尾
  icsContent += 'END:VCALENDAR\r\n';

  // 创建 Blob 并下载
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.ics`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出数据为 JSON 格式
 * @param data 要导出的数据
 * @param filename 文件名
 */
export function exportToJSON(data: any[], filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出日历事件为 HTML 格式（可直接在浏览器中查看）
 * @param events 要导出的事件数组
 * @param filename 文件名（不含扩展名）
 * @param options 导出选项
 */
export function exportToHTML(
  events: Array<{
    id: number;
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    location?: string;
    status?: string;
    applicantName?: string;
    reason?: string;
  }>,
  filename: string = 'calendar',
  options?: {
    title?: string;
    subtitle?: string;
  }
) {
  if (events.length === 0) {
    console.warn('No events to export');
    return;
  }

  // 格式化日期
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 获取状态标签和颜色
  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'approved':
        return { label: '已批准', color: '#10b981', bg: '#d1fae5' };
      case 'pending':
        return { label: '待审核', color: '#f59e0b', bg: '#fef3c7' };
      case 'rejected':
        return { label: '已拒绝', color: '#ef4444', bg: '#fee2e2' };
      case 'cancelled':
        return { label: '已取消', color: '#6b7280', bg: '#f3f4f6' };
      case 'completed':
        return { label: '已完成', color: '#3b82f6', bg: '#dbeafe' };
      default:
        return { label: '未知', color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  // 按日期分组事件
  const eventsByDate = new Map<string, typeof events>();
  events.forEach(event => {
    const dateKey = formatDate(event.startTime).split(' ')[0];
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  });

  // 生成事件 HTML
  const eventsHTML = Array.from(eventsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEvents]) => {
      const eventsList = dayEvents
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        .map(event => {
          const statusInfo = getStatusInfo(event.status);
          return `
            <div class="event-item">
              <div class="event-time">
                <span class="time-start">${formatDate(event.startTime).split(' ')[1]}</span>
                <span class="time-separator">-</span>
                <span class="time-end">${formatDate(event.endTime).split(' ')[1]}</span>
              </div>
              <div class="event-content">
                <div class="event-header">
                  <h3 class="event-title">${escapeHtml(event.title)}</h3>
                  <span class="event-status" style="background-color: ${statusInfo.bg}; color: ${statusInfo.color};">
                    ${statusInfo.label}
                  </span>
                </div>
                <div class="event-details">
                  ${event.location ? `<div class="event-detail"><strong>地点：</strong>${escapeHtml(event.location)}</div>` : ''}
                  ${event.applicantName ? `<div class="event-detail"><strong>申请人：</strong>${escapeHtml(event.applicantName)}</div>` : ''}
                  ${event.reason ? `<div class="event-detail"><strong>原因：</strong>${escapeHtml(event.reason)}</div>` : ''}
                  ${event.description ? `<div class="event-detail"><strong>描述：</strong>${escapeHtml(event.description)}</div>` : ''}
                  <div class="event-detail"><strong>预约ID：</strong>${event.id}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="date-section">
          <h2 class="date-header">${date}</h2>
          <div class="events-list">
            ${eventsList}
          </div>
        </div>
      `;
    })
    .join('');

  // HTML 模板
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options?.title || '预约日历'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 40px;
    }
    .header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: #6b7280;
      font-size: 14px;
    }
    .summary {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 30px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    .summary-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .summary-value {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
    }
    .date-section {
      margin-bottom: 40px;
    }
    .date-header {
      font-size: 20px;
      color: #1f2937;
      padding: 12px 0;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 16px;
    }
    .events-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .event-item {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      gap: 16px;
      transition: box-shadow 0.2s;
    }
    .event-item:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .event-time {
      min-width: 120px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .time-start, .time-end {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
    .time-separator {
      color: #9ca3af;
      margin: 4px 0;
    }
    .event-content {
      flex: 1;
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .event-title {
      font-size: 18px;
      color: #1f2937;
      font-weight: 600;
      flex: 1;
    }
    .event-status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      margin-left: 12px;
    }
    .event-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .event-detail {
      font-size: 14px;
      color: #6b7280;
    }
    .event-detail strong {
      color: #374151;
      margin-right: 4px;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
      .event-item {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${options?.title || '预约日历'}</h1>
      ${options?.subtitle ? `<div class="subtitle">${escapeHtml(options.subtitle)}</div>` : ''}
    </div>
    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">总预约数</span>
        <span class="summary-value">${events.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">已批准</span>
        <span class="summary-value">${events.filter(e => e.status === 'approved').length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">待审核</span>
        <span class="summary-value">${events.filter(e => e.status === 'pending').length}</span>
      </div>
    </div>
    ${eventsHTML}
  </div>
</body>
</html>`;

  // HTML 转义函数
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 创建 Blob 并下载
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.html`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
