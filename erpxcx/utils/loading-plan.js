const PLAN_KEY = 'mini_loading_plan_items';
const UNIT_PACKAGE = 'package';
const UNIT_SHEET = 'sheet';

function toNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : fallback;
}

function toPositiveNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function formatNumberText(value, decimalPlaces) {
  const places = decimalPlaces === undefined ? 2 : decimalPlaces;
  const scale = 10 ** places;
  const rounded = Math.round(Number(value || 0) * scale) / scale;

  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(places).replace(/\.?0+$/, '');
}

function normalizeProductUnitLabel(value) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();

  if (['piece', 'pieces', 'package', 'packages', 'box', 'unit', '件'].includes(lower)) {
    return '件';
  }
  if (['sheet', 'sheets', 'tile', 'tiles', '片'].includes(lower)) {
    return '片';
  }

  return raw || '片';
}

function parsePiecesPerUnit(packageText) {
  const text = String(packageText || '').trim();
  if (!text) return null;

  const directMatch = text.match(/1\s*件\s*[=＝:：]?\s*(\d+)\s*片/);
  if (directMatch) return toNumber(directMatch[1], null);

  const perPackageMatch = text.match(/(\d+)\s*片\s*\/\s*件/);
  if (perPackageMatch) return toNumber(perPackageMatch[1], null);

  return null;
}

function parseWeightInfo(weightText) {
  const text = String(weightText || '').trim();
  if (!text) return { unitLabel: '', weightKgPerUnit: null };

  const match = text.match(/([\d.]+)\s*(?:kg|公斤|千克)\s*\/\s*([^\s/]+)/i);
  if (!match) return { unitLabel: '', weightKgPerUnit: null };

  return {
    unitLabel: normalizeProductUnitLabel(match[2]),
    weightKgPerUnit: toPositiveNumber(match[1], null),
  };
}

function normalizeQuantityUnit(value, fallback) {
  const raw = String(value || '').trim().toLowerCase();
  if (['package', 'packages', 'box', 'boxes', 'unit', 'units', '件'].includes(raw)) {
    return UNIT_PACKAGE;
  }
  if (['sheet', 'sheets', 'tile', 'tiles', '片'].includes(raw)) {
    return UNIT_SHEET;
  }

  return fallback || UNIT_SHEET;
}

function resolveDefaultQuantityUnit(product) {
  const piecesPerUnit =
    toNumber(product.piecesPerUnit, null) ||
    parsePiecesPerUnit(product.packageText);
  const unitLabel = normalizeProductUnitLabel(product.unitLabel || product.unit);

  if (piecesPerUnit && piecesPerUnit > 1) return UNIT_PACKAGE;
  if (unitLabel === '件') return UNIT_PACKAGE;
  return UNIT_SHEET;
}

function normalizePlanItem(raw) {
  const product = raw || {};
  const id = String(product.id || '').trim();
  if (!id) return null;

  const weightInfo = parseWeightInfo(product.weightText);
  const unitLabel = normalizeProductUnitLabel(
    product.unitLabel || weightInfo.unitLabel || product.unit
  );
  const piecesPerUnit =
    toNumber(product.piecesPerUnit, null) ||
    parsePiecesPerUnit(product.packageText);
  const defaultQuantityUnit = resolveDefaultQuantityUnit({
    ...product,
    unitLabel,
    piecesPerUnit,
  });

  return {
    id,
    code: String(product.code || '').trim(),
    name: String(product.name || '').trim(),
    specification: String(product.specification || '').trim(),
    unit: String(product.unit || '').trim(),
    unitLabel,
    piecesPerUnit,
    weightKgPerUnit:
      toPositiveNumber(product.weightKgPerUnit, null) ||
      toPositiveNumber(product.weight, null) ||
      weightInfo.weightKgPerUnit,
    packageText: String(product.packageText || '').trim(),
    weightText: String(product.weightText || '').trim(),
    thumbnailUrl: String(product.thumbnailUrl || '').trim(),
    colorName:
      String(product.colorName || '').trim() ||
      String(product.colorSeriesName || '').trim() ||
      String((product.colorSeries && product.colorSeries.name) || '').trim(),
    componentName:
      String(product.componentName || '').trim() ||
      String(product.componentTypeLabel || '').trim() ||
      String((product.componentType && product.componentType.label) || '').trim(),
    quantity: toNumber(product.quantity, 1),
    quantityUnit: normalizeQuantityUnit(product.quantityUnit, defaultQuantityUnit),
    remark: String(product.remark || '').trim(),
    updatedAt: product.updatedAt || Date.now(),
  };
}

function getPlanItems() {
  const stored = wx.getStorageSync(PLAN_KEY);
  if (!Array.isArray(stored)) return [];

  return stored.map(normalizePlanItem).filter(Boolean);
}

function savePlanItems(items) {
  wx.setStorageSync(
    PLAN_KEY,
    (items || []).map(normalizePlanItem).filter(Boolean)
  );
}

function getPlanCount() {
  return getPlanItems().length;
}

function isSamePlanItem(currentItem, nextItem) {
  if (!currentItem || !nextItem) return false;
  if (currentItem.id === nextItem.id) return true;

  const currentCode = String(currentItem.code || '').trim();
  const nextCode = String(nextItem.code || '').trim();
  return Boolean(currentCode && nextCode && currentCode === nextCode);
}

function upsertPlanItem(product, quantity) {
  const nextItem = normalizePlanItem({
    ...product,
    quantity: toNumber(quantity, 1),
    updatedAt: Date.now(),
  });
  if (!nextItem) return { items: getPlanItems(), item: null, existed: false };

  const items = getPlanItems();
  const index = items.findIndex(item => isSamePlanItem(item, nextItem));

  if (index >= 0) {
    items[index] = {
      ...items[index],
      id: nextItem.id,
      code: nextItem.code,
      name: nextItem.name,
      specification: nextItem.specification,
      unit: nextItem.unit,
      unitLabel: nextItem.unitLabel,
      piecesPerUnit: nextItem.piecesPerUnit,
      weightKgPerUnit: nextItem.weightKgPerUnit,
      packageText: nextItem.packageText,
      weightText: nextItem.weightText,
      thumbnailUrl: nextItem.thumbnailUrl,
      colorName: nextItem.colorName,
      componentName: nextItem.componentName,
      quantity: items[index].quantity,
      quantityUnit: items[index].quantityUnit,
      remark: items[index].remark,
      updatedAt: Date.now(),
    };
    savePlanItems(items);
    return { items, item: items[index], existed: true };
  } else {
    items.unshift(nextItem);
  }

  savePlanItems(items);
  return { items, item: nextItem, existed: false };
}

function updatePlanItem(id, patch) {
  const items = getPlanItems();
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return items;

  items[index] = normalizePlanItem({
    ...items[index],
    ...patch,
    quantity: patch && patch.quantity !== undefined
      ? toNumber(patch.quantity, 1)
      : items[index].quantity,
    quantityUnit: patch && patch.quantityUnit !== undefined
      ? normalizeQuantityUnit(patch.quantityUnit, items[index].quantityUnit)
      : items[index].quantityUnit,
    updatedAt: Date.now(),
  });

  savePlanItems(items);
  return items;
}

function removePlanItem(id) {
  const items = getPlanItems().filter(item => item.id !== id);
  savePlanItems(items);
  return items;
}

function clearPlanItems() {
  wx.removeStorageSync(PLAN_KEY);
}

function getQuantityUnitLabel(item) {
  return item.quantityUnit === UNIT_PACKAGE ? '件' : '片';
}

function getSheetQuantity(item) {
  if (item.quantityUnit === UNIT_SHEET) return item.quantity;
  if (item.piecesPerUnit && item.piecesPerUnit > 0) {
    return item.quantity * item.piecesPerUnit;
  }

  return null;
}

function getItemWeightKg(item) {
  const weight = toPositiveNumber(item.weightKgPerUnit, null);
  if (!weight) return null;

  const unitLabel = normalizeProductUnitLabel(item.unitLabel || item.unit);
  if (item.quantityUnit === UNIT_PACKAGE) {
    if (unitLabel === '件') return item.quantity * weight;

    const sheetQuantity = getSheetQuantity(item);
    return sheetQuantity === null ? null : sheetQuantity * weight;
  }

  if (unitLabel === '片') return item.quantity * weight;
  if (item.piecesPerUnit && item.piecesPerUnit > 0) {
    return item.quantity * (weight / item.piecesPerUnit);
  }

  return null;
}

function buildPlanItemView(item) {
  const normalized = normalizePlanItem(item);
  if (!normalized) return null;

  const sheetQuantity = getSheetQuantity(normalized);
  const weightKg = getItemWeightKg(normalized);
  const canSwitchUnit = Boolean(
    normalized.piecesPerUnit && normalized.piecesPerUnit > 1
  );

  return {
    ...normalized,
    canSwitchUnit,
    quantityUnitLabel: getQuantityUnitLabel(normalized),
    quantityText: `${normalized.quantity}${getQuantityUnitLabel(normalized)}`,
    packageInfoText: canSwitchUnit
      ? `1件=${normalized.piecesPerUnit}片`
      : normalized.packageText,
    convertedPiecesText:
      normalized.quantityUnit === UNIT_PACKAGE && sheetQuantity !== null
        ? `折合${formatNumberText(sheetQuantity, 0)}片`
        : '',
    itemWeightText: weightKg
      ? `约${formatNumberText(weightKg, 2)}kg`
      : '',
  };
}

function buildPlanSummary(items) {
  const list = (items || []).map(normalizePlanItem).filter(Boolean);
  let packageQuantity = 0;
  let sheetInputQuantity = 0;
  let convertedSheetQuantity = 0;
  let hasPackageInput = false;
  let totalWeightKg = 0;
  let missingWeightCount = 0;

  list.forEach(item => {
    if (item.quantityUnit === UNIT_PACKAGE) {
      packageQuantity += item.quantity;
      hasPackageInput = true;
    } else {
      sheetInputQuantity += item.quantity;
    }

    const sheetQuantity = getSheetQuantity(item);
    if (sheetQuantity !== null) {
      convertedSheetQuantity += sheetQuantity;
    }

    const weightKg = getItemWeightKg(item);
    if (weightKg !== null) {
      totalWeightKg += weightKg;
    } else {
      missingWeightCount += 1;
    }
  });

  const parts = [`${list.length}款`];
  if (packageQuantity > 0) parts.push(`${formatNumberText(packageQuantity, 0)}件`);
  if (sheetInputQuantity > 0) parts.push(`${formatNumberText(sheetInputQuantity, 0)}片`);
  if (hasPackageInput && convertedSheetQuantity > 0) {
    parts.push(`折合${formatNumberText(convertedSheetQuantity, 0)}片`);
  }
  if (totalWeightKg > 0) {
    parts.push(`约${formatNumberText(totalWeightKg, 2)}kg`);
  }

  return {
    itemCount: list.length,
    packageQuantity,
    sheetInputQuantity,
    convertedSheetQuantity,
    totalWeightKg,
    missingWeightCount,
    summaryText: parts.join('｜'),
    weightText: totalWeightKg > 0 ? `约${formatNumberText(totalWeightKg, 2)}kg` : '',
    weightNote:
      missingWeightCount > 0
        ? `${missingWeightCount}款未维护重量，合计重量仅供预估`
        : '',
  };
}

function buildPlanText(items) {
  const list = (items || []).map(normalizePlanItem).filter(Boolean);
  if (list.length === 0) return '';

  const summary = buildPlanSummary(list);
  const lines = ['报货计划', `合计：${summary.summaryText}`];
  if (summary.weightNote) {
    lines.push(`说明：${summary.weightNote}`);
  }

  list.forEach((item, index) => {
    const viewItem = buildPlanItemView(item);
    lines.push(
      `${index + 1}. ${item.code} ${item.name}`,
      `   规格：${item.specification || '未填写'}`,
      `   数量：${item.quantity}${getQuantityUnitLabel(item)}`
    );
    if (viewItem && (viewItem.packageInfoText || viewItem.convertedPiecesText)) {
      lines.push(
        `   换算：${[viewItem.packageInfoText, viewItem.convertedPiecesText]
          .filter(Boolean)
          .join('；')}`
      );
    }
    if (viewItem && viewItem.itemWeightText) {
      lines.push(`   预估重量：${viewItem.itemWeightText}`);
    } else if (item.weightText) {
      lines.push(`   重量资料：${item.weightText}`);
    }
    if (item.remark) {
      lines.push(`   备注：${item.remark}`);
    }
  });

  return lines.join('\n');
}

module.exports = {
  buildPlanItemView,
  buildPlanSummary,
  buildPlanText,
  clearPlanItems,
  getPlanCount,
  getPlanItems,
  removePlanItem,
  savePlanItems,
  updatePlanItem,
  upsertPlanItem,
};
