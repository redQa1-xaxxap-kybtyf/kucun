import type { PrintTemplate } from '@/lib/print-designer/schemas';

interface PrintFrameOptions {
  template: PrintTemplate;
  content: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

export function getCssPageSize(
  settings: PrintTemplate['pageSettings']
): string {
  if (settings.size === 'Custom') {
    return `${settings.width}mm ${settings.height}mm`;
  }

  return `${settings.size} ${settings.orientation}`;
}

function buildPrintDocument({ template, content }: PrintFrameOptions): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(template.name)}</title>
        <style>
          @page {
            size: ${getCssPageSize(template.pageSettings)};
            margin: 0;
          }

          html,
          body {
            width: 100%;
            min-height: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          body {
            font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
          }

          *,
          *::before,
          *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @media print {
            html,
            body {
              background: #ffffff;
            }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `;
}

export async function printTemplateContent({
  template,
  content,
}: PrintFrameOptions): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('打印功能仅在浏览器环境中可用');
  }

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    let settled = false;
    let printStarted = false;
    let fallbackTimer: number | undefined;

    const cleanup = () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      iframe.remove();
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('调起打印失败'));
    };

    const runPrint = () => {
      if (printStarted || settled) return;
      printStarted = true;

      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        fail(new Error('无法创建打印窗口'));
        return;
      }

      const handleAfterPrint = () => {
        window.setTimeout(finish, 250);
      };

      try {
        printWindow.addEventListener('afterprint', handleAfterPrint, {
          once: true,
        });
        printWindow.focus();
        printWindow.print();

        fallbackTimer = window.setTimeout(finish, 1500);
      } catch (error) {
        printWindow.removeEventListener('afterprint', handleAfterPrint);
        fail(error);
      }
    };

    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    iframe.onload = () => {
      window.setTimeout(runPrint, 80);
    };

    document.body.appendChild(iframe);

    const printDocument =
      iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!printDocument) {
      fail(new Error('无法创建打印文档'));
      return;
    }

    printDocument.open();
    printDocument.write(buildPrintDocument({ template, content }));
    printDocument.close();

    fallbackTimer = window.setTimeout(runPrint, 300);
  });
}
