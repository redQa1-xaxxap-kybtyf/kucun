/**
 * 库存管理功能性能监控脚本
 * 用于自动化收集和分析性能指标
 *
 * 使用方法：
 * node scripts/performance-monitor.js
 */

const fs = require('fs');
const path = require('path');

// 性能监控配置
const MONITOR_CONFIG = {
  // 监控的页面URL
  pages: [
    { name: '库存总览', url: '/inventory', key: 'inventory' },
    { name: '库存调整', url: '/inventory/adjust', key: 'adjust' },
    { name: '调整记录', url: '/inventory/adjustments', key: 'adjustments' },
  ],

  // 性能阈值
  thresholds: {
    pageLoadTime: {
      warning: 5000, // 5秒
      critical: 10000, // 10秒
    },
    apiResponseTime: {
      warning: 2000, // 2秒
      critical: 5000, // 5秒
    },
    memoryUsage: {
      warning: 150, // 150MB
      critical: 200, // 200MB
    },
    errorRate: {
      warning: 0.01, // 1%
      critical: 0.05, // 5%
    },
  },

  // 监控间隔（毫秒）
  interval: 60000, // 1分钟

  // 报告输出目录
  reportDir: path.join(__dirname, '../docs/performance-reports'),
};

// 性能数据存储
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      pages: {},
      alerts: [],
      summary: {},
    };

    // 确保报告目录存在
    if (!fs.existsSync(MONITOR_CONFIG.reportDir)) {
      fs.mkdirSync(MONITOR_CONFIG.reportDir, { recursive: true });
    }
  }

  /**
   * 收集页面性能指标
   */
  async collectPageMetrics(page) {
    const metrics = {
      name: page.name,
      url: page.url,
      timestamp: new Date().toISOString(),
      loadTime: 0,
      domContentLoaded: 0,
      resourceCount: 0,
      apiCallCount: 0,
      memoryUsage: null,
      specificationFields: [],
      errors: [],
    };

    try {
      // 模拟收集性能数据
      // 实际使用时需要集成Playwright或Puppeteer
      metrics.loadTime = Math.random() * 5000 + 2000; // 2-7秒
      metrics.domContentLoaded = Math.random() * 1000; // 0-1秒
      metrics.resourceCount = Math.floor(Math.random() * 20) + 10;
      metrics.apiCallCount = Math.floor(Math.random() * 10) + 3;

      // 检查是否超过阈值
      this.checkThresholds(metrics);
    } catch (error) {
      metrics.errors.push({
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    this.metrics.pages[page.key] = metrics;
    return metrics;
  }

  /**
   * 检查性能阈值
   */
  checkThresholds(metrics) {
    const { thresholds } = MONITOR_CONFIG;

    // 检查页面加载时间
    if (metrics.loadTime > thresholds.pageLoadTime.critical) {
      this.addAlert(
        'critical',
        `${metrics.name}页面加载时间过长: ${Math.round(metrics.loadTime)}ms`
      );
    } else if (metrics.loadTime > thresholds.pageLoadTime.warning) {
      this.addAlert(
        'warning',
        `${metrics.name}页面加载时间较慢: ${Math.round(metrics.loadTime)}ms`
      );
    }
  }

  /**
   * 添加告警
   */
  addAlert(level, message) {
    this.metrics.alerts.push({
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 生成性能摘要
   */
  generateSummary() {
    const pages = Object.values(this.metrics.pages);

    this.metrics.summary = {
      totalPages: pages.length,
      averageLoadTime:
        pages.reduce((sum, p) => sum + p.loadTime, 0) / pages.length,
      totalAlerts: this.metrics.alerts.length,
      criticalAlerts: this.metrics.alerts.filter(a => a.level === 'critical')
        .length,
      warningAlerts: this.metrics.alerts.filter(a => a.level === 'warning')
        .length,
      status: this.metrics.alerts.some(a => a.level === 'critical')
        ? 'critical'
        : this.metrics.alerts.some(a => a.level === 'warning')
          ? 'warning'
          : 'healthy',
    };
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport() {
    const { timestamp, pages, alerts, summary } = this.metrics;

    let report = `# 性能监控报告\n\n`;
    report += `> 生成时间：${new Date(timestamp).toLocaleString('zh-CN')}\n\n`;
    report += `---\n\n`;

    // 摘要
    report += `## 📊 监控摘要\n\n`;
    report += `- **监控页面数**：${summary.totalPages}\n`;
    report += `- **平均加载时间**：${Math.round(summary.averageLoadTime)}ms\n`;
    report += `- **告警总数**：${summary.totalAlerts}\n`;
    report += `  - 严重告警：${summary.criticalAlerts}\n`;
    report += `  - 警告告警：${summary.warningAlerts}\n`;
    report += `- **系统状态**：${this.getStatusEmoji(summary.status)} ${summary.status.toUpperCase()}\n\n`;

    // 页面详情
    report += `## 📄 页面性能详情\n\n`;
    Object.values(pages).forEach(page => {
      report += `### ${page.name}\n\n`;
      report += `- **URL**：${page.url}\n`;
      report += `- **加载时间**：${Math.round(page.loadTime)}ms\n`;
      report += `- **DOM加载**：${Math.round(page.domContentLoaded)}ms\n`;
      report += `- **资源数量**：${page.resourceCount}\n`;
      report += `- **API调用**：${page.apiCallCount}\n`;

      if (page.errors.length > 0) {
        report += `- **错误**：\n`;
        page.errors.forEach(error => {
          report += `  - ${error.message}\n`;
        });
      }
      report += `\n`;
    });

    // 告警信息
    if (alerts.length > 0) {
      report += `## 🔔 告警信息\n\n`;
      alerts.forEach(alert => {
        const emoji = alert.level === 'critical' ? '🔴' : '⚠️';
        report += `${emoji} **${alert.level.toUpperCase()}**: ${alert.message}\n`;
      });
      report += `\n`;
    }

    // 建议
    report += `## 💡 优化建议\n\n`;
    if (summary.status === 'critical') {
      report += `- 🔴 系统存在严重性能问题，需要立即处理\n`;
      report += `- 检查数据库查询性能\n`;
      report += `- 优化API响应时间\n`;
      report += `- 检查服务器资源使用情况\n`;
    } else if (summary.status === 'warning') {
      report += `- ⚠️ 系统性能有待优化\n`;
      report += `- 考虑增加缓存策略\n`;
      report += `- 优化前端资源加载\n`;
      report += `- 监控数据库连接池\n`;
    } else {
      report += `- ✅ 系统运行正常，继续保持\n`;
      report += `- 持续监控关键指标\n`;
      report += `- 定期审查性能趋势\n`;
    }

    return report;
  }

  /**
   * 获取状态表情符号
   */
  getStatusEmoji(status) {
    const emojis = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🔴',
    };
    return emojis[status] || '❓';
  }

  /**
   * 保存报告
   */
  saveReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-report-${timestamp}.md`;
    const filepath = path.join(MONITOR_CONFIG.reportDir, filename);

    const report = this.generateMarkdownReport();
    fs.writeFileSync(filepath, report, 'utf8');

    console.log(`✅ 性能报告已保存：${filepath}`);
    return filepath;
  }

  /**
   * 保存JSON数据
   */
  saveMetrics() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-metrics-${timestamp}.json`;
    const filepath = path.join(MONITOR_CONFIG.reportDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(this.metrics, null, 2), 'utf8');

    console.log(`✅ 性能数据已保存：${filepath}`);
    return filepath;
  }
}

/**
 * 主监控函数
 */
async function runMonitoring() {
  console.log('🚀 开始性能监控...\n');

  const monitor = new PerformanceMonitor();

  // 收集所有页面的性能指标
  for (const page of MONITOR_CONFIG.pages) {
    console.log(`📊 监控页面：${page.name} (${page.url})`);
    await monitor.collectPageMetrics(page);
  }

  // 生成摘要
  monitor.generateSummary();

  // 保存报告
  monitor.saveReport();
  monitor.saveMetrics();

  // 输出摘要
  console.log('\n📊 监控摘要：');
  console.log(`- 监控页面数：${monitor.metrics.summary.totalPages}`);
  console.log(
    `- 平均加载时间：${Math.round(monitor.metrics.summary.averageLoadTime)}ms`
  );
  console.log(`- 告警总数：${monitor.metrics.summary.totalAlerts}`);
  console.log(
    `- 系统状态：${monitor.getStatusEmoji(monitor.metrics.summary.status)} ${monitor.metrics.summary.status.toUpperCase()}`
  );

  console.log('\n✅ 性能监控完成！');
}

// 执行监控
if (require.main === module) {
  runMonitoring().catch(error => {
    console.error('❌ 监控执行失败：', error);
    process.exit(1);
  });
}

module.exports = { PerformanceMonitor, MONITOR_CONFIG };
