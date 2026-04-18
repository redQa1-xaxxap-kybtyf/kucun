export function getTableMinRowsQuickOptions(templateType: string): number[] {
  switch (templateType) {
    case 'delivery-note':
    case 'sales-order':
      return [6, 8, 10, 12];
    case 'factory-shipment':
      return [8, 10, 12, 15];
    case 'purchase-order':
      return [5, 8, 10, 12];
    default:
      return [6, 8, 10, 12];
  }
}

export function getTableFooterNoteQuickOptions(templateType: string): string[] {
  switch (templateType) {
    case 'delivery-note':
    case 'sales-order':
      return [
        '请核对品名、规格、数量无误后签收。',
        '以上数量请现场复核后确认。',
        '签收后如有问题，请于当天反馈。',
      ];
    case 'purchase-order':
      return [
        '请按到货数量、规格核对后确认。',
        '如有破损、缺件，请当场注明。',
        '到货异常请及时与供应方联系。',
      ];
    case 'factory-shipment':
      return [
        '请按装车顺序核对品名和数量。',
        '到货后如有差异，请及时反馈。',
        '请按清单逐项核对后确认。',
      ];
    default:
      return [
        '请核对品名、规格、数量无误后确认。',
        '以上内容如有差异，请及时反馈。',
        '请按单据逐项核对后确认。',
      ];
  }
}
