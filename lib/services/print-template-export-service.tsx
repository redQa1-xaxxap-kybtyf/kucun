'use client';

import { createRoot } from 'react-dom/client';

import { PrintCanvas } from '@/components/print-designer/renderer/PrintCanvas';
import {
  getDefaultTemplate,
  getPrintDataForTemplate,
} from '@/lib/print-designer/actions';
import type { TemplateType } from '@/lib/print-designer/schemas';

import { ExportService, type ImageExportOptions } from './export-service';

type PrintTemplateExportErrorCode =
  | 'template_load_failed'
  | 'template_not_configured'
  | 'data_not_found';

export class PrintTemplateExportError extends Error {
  readonly code: PrintTemplateExportErrorCode;

  constructor(code: PrintTemplateExportErrorCode, message: string) {
    super(message);
    this.name = 'PrintTemplateExportError';
    this.code = code;
  }
}

export function isPrintTemplateExportError(
  error: unknown
): error is PrintTemplateExportError {
  return error instanceof PrintTemplateExportError;
}

interface BaseTemplateImageExportOptions
  extends Omit<ImageExportOptions, 'filename'> {
  templateType: TemplateType;
  filename: string;
}

interface TemplateDocumentImageExportOptions
  extends BaseTemplateImageExportOptions {
  documentId: string;
}

interface TemplateDataImageExportOptions
  extends BaseTemplateImageExportOptions {
  data: Record<string, unknown>;
}

function ensureBrowserContext() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('打印模板导出只能在浏览器环境使用');
  }
}

async function loadDefaultTemplate(templateType: TemplateType) {
  const templateResult = await getDefaultTemplate(templateType);

  if (!templateResult.success) {
    throw new PrintTemplateExportError(
      'template_load_failed',
      templateResult.error ?? '获取默认模板失败'
    );
  }

  if (!templateResult.data) {
    throw new PrintTemplateExportError(
      'template_not_configured',
      '该单据类型未配置默认打印模板，请先在打印模板中设置默认模板。'
    );
  }

  return templateResult.data;
}

function createHiddenContainer() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);
  return container;
}

async function waitForPaint() {
  await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
  await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
}

async function renderTemplateForExport(
  templateType: TemplateType,
  data: Record<string, unknown>
) {
  ensureBrowserContext();

  const template = await loadDefaultTemplate(templateType);
  const container = createHiddenContainer();
  const root = createRoot(container);

  root.render(<PrintCanvas template={template} data={data} scale={1} />);
  await waitForPaint();

  return {
    container,
    root,
  };
}

async function exportContainerToImage(
  container: HTMLElement,
  options: BaseTemplateImageExportOptions
) {
  const { filename, ...imageOptions } = options;
  await ExportService.exportToImage(container, {
    ...imageOptions,
    filename,
  });
}

function cleanupExportRender(
  root: ReturnType<typeof createRoot>,
  container: HTMLElement
) {
  root.unmount();
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

export class PrintTemplateExportService {
  static async exportDocumentToImage(
    options: TemplateDocumentImageExportOptions
  ): Promise<void> {
    const { templateType, documentId } = options;
    const data = await getPrintDataForTemplate(templateType, documentId);

    if (!data) {
      throw new PrintTemplateExportError(
        'data_not_found',
        '未找到可导出的打印数据'
      );
    }

    const { container, root } = await renderTemplateForExport(
      templateType,
      data
    );

    try {
      await exportContainerToImage(container, options);
    } finally {
      cleanupExportRender(root, container);
    }
  }

  static async exportDataToImage(
    options: TemplateDataImageExportOptions
  ): Promise<void> {
    const { templateType, data } = options;
    const { container, root } = await renderTemplateForExport(
      templateType,
      data
    );

    try {
      await exportContainerToImage(container, options);
    } finally {
      cleanupExportRender(root, container);
    }
  }
}
