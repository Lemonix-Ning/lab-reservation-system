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
