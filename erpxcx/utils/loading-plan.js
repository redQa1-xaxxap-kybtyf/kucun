const PLAN_KEY = 'mini_loading_plan_items';
const UNIT_PACKAGE = 'package';
const UNIT_SHEET = 'sheet';

function toNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : fallback;
}

function toQuantityNumber(value, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;

  return Math.round(numberValue * 100) / 100;
}

function toNonNegativeQuantityNumber(value, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return fallback;

  return Math.round(numberValue * 100) / 100;
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

function formatQuantityText(value) {
  return formatNumberText(value, Number.isInteger(Number(value)) ? 0 : 2);
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

function normalizeOptionalProductUnitLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return normalizeProductUnitLabel(raw);
}

function resolveSheetQuantity(product, quantityUnit, piecesPerUnit) {
  const explicitSheetQuantity = toNonNegativeQuantityNumber(
    product.sheetQuantity,
    null
  );
  if (explicitSheetQuantity !== null) return explicitSheetQuantity;

  if (quantityUnit === UNIT_PACKAGE && piecesPerUnit && piecesPerUnit > 0) {
    const packageQuantity = toNonNegativeQuantityNumber(product.quantity, 0);
    const remainderSheets = toNonNegativeQuantityNumber(
      product.remainderSheets,
      0
    );
    return packageQuantity * piecesPerUnit + remainderSheets;
  }

  return toQuantityNumber(product.quantity, 1);
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

function resolveWeightUnitLabel(product, weightInfo, piecesPerUnit) {
  const explicitWeightUnit = normalizeOptionalProductUnitLabel(
    product.weightUnitLabel || product.weightUnit
  );
  if (explicitWeightUnit) return explicitWeightUnit;

  if (weightInfo.unitLabel) return weightInfo.unitLabel;
  if (piecesPerUnit && piecesPerUnit > 1) return '件';

  return normalizeProductUnitLabel(product.unitLabel || product.unit);
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

function normalizeProductSource(value, temporaryProductId) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'external' || raw === 'temporary') return 'external';
  if (temporaryProductId) return 'external';

  return 'own';
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
  const productSource = normalizeProductSource(
    product.productSource || product.source,
    product.temporaryProductId
  );
  const temporaryProductId =
    productSource === 'external'
      ? String(product.temporaryProductId || id).trim()
      : '';
  const productId =
    productSource === 'own' ? String(product.productId || id).trim() : '';

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

  const quantityUnit = normalizeQuantityUnit(
    product.quantityUnit,
    defaultQuantityUnit
  );
  const sheetQuantity = resolveSheetQuantity(
    product,
    quantityUnit,
    piecesPerUnit
  );
  const breakdown =
    quantityUnit === UNIT_PACKAGE && piecesPerUnit && piecesPerUnit > 0
      ? normalizePackageBreakdown({
          piecesPerUnit,
          packages: Math.floor(sheetQuantity / piecesPerUnit),
          remainderSheets:
            Math.round((sheetQuantity % piecesPerUnit) * 100) / 100,
        })
      : null;
  const quantity =
    quantityUnit === UNIT_PACKAGE
      ? breakdown && breakdown.packages > 0
        ? breakdown.packages
        : sheetQuantity > 0
          ? Math.floor(sheetQuantity / (piecesPerUnit || 1))
          : 1
      : sheetQuantity;
  const remainderSheets =
    quantityUnit === UNIT_PACKAGE && breakdown ? breakdown.remainderSheets : 0;

  return {
    id,
    productId,
    temporaryProductId,
    productSource,
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
    weightUnitLabel: resolveWeightUnitLabel(product, weightInfo, piecesPerUnit),
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
    quantity,
    quantityUnit,
    remainderSheets,
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

function hasPlanItem(product, planItems) {
  const nextItem = normalizePlanItem(product);
  if (!nextItem) return false;

  const items = Array.isArray(planItems) ? planItems : getPlanItems();
  return items.some(item => isSamePlanItem(item, nextItem));
}

function upsertPlanItem(product, quantity) {
  const nextItem = normalizePlanItem({
    ...product,
    quantity: toQuantityNumber(quantity, 1),
    updatedAt: Date.now(),
  });
  if (!nextItem) return { items: getPlanItems(), item: null, existed: false };

  const items = getPlanItems();
  const index = items.findIndex(item => isSamePlanItem(item, nextItem));

  if (index >= 0) {
    items[index] = {
      ...items[index],
      id: nextItem.id,
      productId: nextItem.productId,
      temporaryProductId: nextItem.temporaryProductId,
      productSource: nextItem.productSource,
      code: nextItem.code,
      name: nextItem.name,
      specification: nextItem.specification,
      unit: nextItem.unit,
      unitLabel: nextItem.unitLabel,
      piecesPerUnit: nextItem.piecesPerUnit,
      weightKgPerUnit: nextItem.weightKgPerUnit,
      weightUnitLabel: nextItem.weightUnitLabel,
      packageText: nextItem.packageText,
      weightText: nextItem.weightText,
      thumbnailUrl: nextItem.thumbnailUrl,
      colorName: nextItem.colorName,
      componentName: nextItem.componentName,
      quantity: items[index].quantity,
      quantityUnit: items[index].quantityUnit,
      remainderSheets: items[index].remainderSheets,
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

  const currentItem = items[index];
  const currentPiecesPerUnit = toNumber(currentItem.piecesPerUnit, null);
  const nextQuantityUnit =
    patch && patch.quantityUnit !== undefined
      ? normalizeQuantityUnit(patch.quantityUnit, currentItem.quantityUnit)
      : currentItem.quantityUnit;
  const hasQuantityPatch = patch && patch.quantity !== undefined;
  const hasRemainderPatch = patch && patch.remainderSheets !== undefined;
  const currentSheetQuantity = getSheetQuantity(currentItem);
  let nextQuantity = hasQuantityPatch
    ? toNonNegativeQuantityNumber(patch.quantity, 1)
    : currentItem.quantity;
  let nextRemainderSheets = hasRemainderPatch
    ? toNonNegativeQuantityNumber(patch.remainderSheets, 0)
    : toNonNegativeQuantityNumber(currentItem.remainderSheets, 0);

  if (
    !hasQuantityPatch &&
    currentPiecesPerUnit &&
    currentPiecesPerUnit > 0 &&
    nextQuantityUnit === UNIT_PACKAGE
  ) {
    const sheetQuantity =
      currentSheetQuantity !== null ? currentSheetQuantity : 0;
    nextQuantity = Math.floor(sheetQuantity / currentPiecesPerUnit);
    nextRemainderSheets =
      Math.round((sheetQuantity - nextQuantity * currentPiecesPerUnit) * 100) /
      100;
  } else if (
    !hasQuantityPatch &&
    currentPiecesPerUnit &&
    currentPiecesPerUnit > 0 &&
    nextQuantityUnit === UNIT_SHEET
  ) {
    const sheetQuantity =
      currentSheetQuantity !== null ? currentSheetQuantity : 0;
    nextQuantity = sheetQuantity;
    nextRemainderSheets = 0;
  }

  items[index] = normalizePlanItem({
    ...currentItem,
    ...patch,
    quantity: nextQuantity,
    quantityUnit: nextQuantityUnit,
    remainderSheets: nextRemainderSheets,
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

function removePlanProduct(product) {
  const targetItem = normalizePlanItem(product);
  if (!targetItem) return getPlanItems();

  const items = getPlanItems().filter(item => !isSamePlanItem(item, targetItem));
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
    const remainderSheets = toNonNegativeQuantityNumber(
      item.remainderSheets,
      0
    );
    return item.quantity * item.piecesPerUnit + remainderSheets;
  }

  return null;
}

function getPackageQuantity(item) {
  if (item.quantityUnit === UNIT_PACKAGE) {
    if (item.piecesPerUnit && item.piecesPerUnit > 0) {
      const remainderSheets = toNonNegativeQuantityNumber(
        item.remainderSheets,
        0
      );
      return item.quantity + remainderSheets / item.piecesPerUnit;
    }

    return item.quantity;
  }
  if (item.piecesPerUnit && item.piecesPerUnit > 0) {
    return item.quantity / item.piecesPerUnit;
  }

  return null;
}

function getPackageBreakdown(item) {
  if (!item.piecesPerUnit || item.piecesPerUnit <= 0) return null;

  if (item.quantityUnit === UNIT_PACKAGE) {
    return {
      packages: item.quantity,
      remainderSheets: toNonNegativeQuantityNumber(item.remainderSheets, 0),
    };
  }

  const sheetQuantity = getSheetQuantity(item);
  if (sheetQuantity === null) return null;

  const packages = Math.floor(sheetQuantity / item.piecesPerUnit);
  const remainderSheets =
    Math.round((sheetQuantity - packages * item.piecesPerUnit) * 100) / 100;

  return {
    packages,
    remainderSheets,
  };
}

function formatPackageBreakdownText(breakdown) {
  if (!breakdown) return '';

  const parts = [];
  if (breakdown.packages > 0) {
    parts.push(`${formatQuantityText(breakdown.packages)}件`);
  }
  if (breakdown.remainderSheets > 0) {
    parts.push(`${formatQuantityText(breakdown.remainderSheets)}片`);
  }

  return parts.join('+');
}

function addPackageBreakdownByUnit(groups, item) {
  const packageBreakdown = getPackageBreakdown(item);
  if (!packageBreakdown || !item.piecesPerUnit || item.piecesPerUnit <= 0) {
    return groups;
  }

  const key = String(item.piecesPerUnit);
  const current = groups[key] || {
    piecesPerUnit: item.piecesPerUnit,
    packages: 0,
    remainderSheets: 0,
  };
  groups[key] = {
    ...current,
    packages: current.packages + packageBreakdown.packages,
    remainderSheets: current.remainderSheets + packageBreakdown.remainderSheets,
  };

  return groups;
}

function normalizePackageBreakdown(breakdown) {
  if (!breakdown || !breakdown.piecesPerUnit || breakdown.piecesPerUnit <= 0) {
    return breakdown;
  }

  const extraPackages = Math.floor(
    breakdown.remainderSheets / breakdown.piecesPerUnit
  );
  const remainderSheets =
    Math.round(
      (breakdown.remainderSheets - extraPackages * breakdown.piecesPerUnit) *
        100
    ) / 100;

  return {
    packages: breakdown.packages + extraPackages,
    remainderSheets,
  };
}

function formatPackageBreakdownGroups(groups) {
  const parts = Object.keys(groups || {})
    .map(key => formatPackageBreakdownText(normalizePackageBreakdown(groups[key])))
    .filter(Boolean);

  return parts.join('+');
}

function convertQuantityForUnit(item, nextQuantityUnit) {
  const currentUnit = normalizeQuantityUnit(item.quantityUnit, UNIT_SHEET);
  const targetUnit = normalizeQuantityUnit(nextQuantityUnit, currentUnit);
  const quantity = toQuantityNumber(item.quantity, 1);
  const piecesPerUnit = toNumber(item.piecesPerUnit, null);

  if (currentUnit === targetUnit || !piecesPerUnit || piecesPerUnit <= 0) {
    return quantity;
  }

  if (currentUnit === UNIT_PACKAGE && targetUnit === UNIT_SHEET) {
    return Math.round(quantity * piecesPerUnit);
  }

  if (currentUnit === UNIT_SHEET && targetUnit === UNIT_PACKAGE) {
    return toQuantityNumber(quantity / piecesPerUnit, quantity);
  }

  return quantity;
}

function getItemWeightKg(item) {
  const weight = toPositiveNumber(item.weightKgPerUnit, null);
  if (!weight) return null;

  const weightUnitLabel = normalizeProductUnitLabel(
    item.weightUnitLabel || item.unitLabel || item.unit
  );

  if (weightUnitLabel === '件') {
    const packageQuantity = getPackageQuantity(item);
    return packageQuantity === null ? null : packageQuantity * weight;
  }

  if (weightUnitLabel === '片') {
    const sheetQuantity = getSheetQuantity(item);
    return sheetQuantity === null ? null : sheetQuantity * weight;
  }

  return null;
}

function buildPlanItemView(item) {
  const normalized = normalizePlanItem(item);
  if (!normalized) return null;

  const sheetQuantity = getSheetQuantity(normalized);
  const packageQuantity = getPackageQuantity(normalized);
  const packageBreakdown = getPackageBreakdown(normalized);
  const packageBreakdownText = formatPackageBreakdownText(packageBreakdown);
  const weightKg = getItemWeightKg(normalized);
  const canSwitchUnit = Boolean(
    normalized.piecesPerUnit && normalized.piecesPerUnit > 1
  );

  return {
    ...normalized,
    canSwitchUnit,
    quantityUnitLabel: getQuantityUnitLabel(normalized),
    quantityText:
      normalized.quantityUnit === UNIT_PACKAGE && packageBreakdownText
        ? packageBreakdownText
        : `${normalized.quantity}${getQuantityUnitLabel(normalized)}`,
    packageInfoText: canSwitchUnit
      ? `1件=${normalized.piecesPerUnit}片`
      : normalized.packageText,
    convertedPiecesText:
      normalized.quantityUnit === UNIT_PACKAGE && sheetQuantity !== null
        ? `折合${formatQuantityText(sheetQuantity)}片`
        : '',
    convertedPackagesText:
      normalized.quantityUnit === UNIT_SHEET && packageBreakdownText
        ? `折合${packageBreakdownText}`
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
  let convertedPackageQuantity = 0;
  let packageInputBreakdownGroups = {};
  let convertedPackageBreakdownGroups = {};
  let hasPackageInput = false;
  let hasSheetInput = false;
  let totalWeightKg = 0;
  let missingWeightCount = 0;

  list.forEach(item => {
    if (item.quantityUnit === UNIT_PACKAGE) {
      const packageQuantityValue = getPackageQuantity(item);
      packageQuantity +=
        packageQuantityValue === null ? item.quantity : packageQuantityValue;
      packageInputBreakdownGroups = addPackageBreakdownByUnit(
        packageInputBreakdownGroups,
        item
      );
      hasPackageInput = true;
    } else {
      sheetInputQuantity += item.quantity;
      hasSheetInput = true;
    }

    const sheetQuantity = getSheetQuantity(item);
    if (sheetQuantity !== null) {
      convertedSheetQuantity += sheetQuantity;
    }
    const packageQuantityValue = getPackageQuantity(item);
    if (packageQuantityValue !== null) {
      convertedPackageQuantity += packageQuantityValue;
    }
    if (item.quantityUnit === UNIT_SHEET) {
      convertedPackageBreakdownGroups = addPackageBreakdownByUnit(
        convertedPackageBreakdownGroups,
        item
      );
    }

    const weightKg = getItemWeightKg(item);
    if (weightKg !== null) {
      totalWeightKg += weightKg;
    } else {
      missingWeightCount += 1;
    }
  });

  const parts = [`${list.length}款`];
  const packageInputText = formatPackageBreakdownGroups(
    packageInputBreakdownGroups
  );
  if (packageInputText) {
    parts.push(packageInputText);
  } else if (packageQuantity > 0) {
    parts.push(`${formatQuantityText(packageQuantity)}件`);
  }
  if (sheetInputQuantity > 0) parts.push(`${formatQuantityText(sheetInputQuantity)}片`);
  if (hasPackageInput && convertedSheetQuantity > 0) {
    parts.push(`折合${formatQuantityText(convertedSheetQuantity)}片`);
  }
  const convertedPackageText = formatPackageBreakdownGroups(
    convertedPackageBreakdownGroups
  );
  if (hasSheetInput && convertedPackageText) {
    parts.push(`折合${convertedPackageText}`);
  }
  if (totalWeightKg > 0) {
    parts.push(`约${formatNumberText(totalWeightKg, 2)}kg`);
  }

  return {
    itemCount: list.length,
    packageQuantity,
    packageInputText,
    sheetInputQuantity,
    convertedSheetQuantity,
    convertedPackageQuantity,
    convertedPackageText,
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
      `   数量：${viewItem ? viewItem.quantityText : `${item.quantity}${getQuantityUnitLabel(item)}`}`
    );
    if (
      viewItem &&
      (viewItem.packageInfoText ||
        viewItem.convertedPiecesText ||
        viewItem.convertedPackagesText)
    ) {
      lines.push(
        `   换算：${[
          viewItem.packageInfoText,
          viewItem.convertedPiecesText,
          viewItem.convertedPackagesText,
        ]
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

function buildSimplePlanSummaryText(summary) {
  const parts = [];
  if (summary.totalWeightKg > 0) {
    parts.push(`总重量：约${formatNumberText(summary.totalWeightKg, 2)}kg`);
  }

  return parts.join('，');
}

function buildSimplePlanText(items) {
  const list = (items || []).map(buildPlanItemView).filter(Boolean);
  if (list.length === 0) return '';

  const summary = buildPlanSummary(list);
  const lines = list.map((item, index) =>
    `${index + 1}. ${[
      item.specification || '未填写规格',
      item.code,
      item.name,
      item.quantityText,
    ]
      .filter(Boolean)
      .join(' ')}`
  );

  const summaryText = buildSimplePlanSummaryText(summary);
  if (summaryText) {
    lines.push(summaryText);
  }

  return lines.join('\n');
}

function buildGoodsRequestItems(items) {
  return (items || [])
    .map(buildPlanItemView)
    .filter(Boolean)
    .map(item => {
      const sheetQuantity = getSheetQuantity(item);
      const canSubmitAsSheets =
        item.quantityUnit === UNIT_SHEET || sheetQuantity !== null;
      const quantity = canSubmitAsSheets ? sheetQuantity || item.quantity : item.quantity;
      const unit = canSubmitAsSheets ? '片' : item.quantityUnitLabel;
      const quantityText = item.quantityText || `${item.quantity}${item.quantityUnitLabel}`;
      const conversionTexts = [
        item.packageInfoText,
        item.convertedPiecesText,
        item.convertedPackagesText,
      ].filter(Boolean);
      const remarks = [
        `客户填报：${quantityText}`,
        conversionTexts.length ? `换算：${conversionTexts.join('；')}` : '',
        item.itemWeightText ? `预估重量：${item.itemWeightText}` : '',
        item.remark ? `备注：${item.remark}` : '',
      ]
        .filter(Boolean)
        .join('；');

      return {
        productId: item.productSource === 'own' ? item.productId || item.id : undefined,
        temporaryProductId:
          item.productSource === 'external'
            ? item.temporaryProductId || item.id
            : undefined,
        productSource: item.productSource,
        productCode: item.code,
        productName: item.name,
        specification: item.specification || null,
        unit,
        thumbnailUrl: item.thumbnailUrl || null,
        quantity: Math.max(1, Math.round(quantity || 1)),
        remarks,
      };
    });
}

module.exports = {
  buildGoodsRequestItems,
  buildPlanItemView,
  buildPlanSummary,
  buildSimplePlanText,
  buildPlanText,
  clearPlanItems,
  getPlanCount,
  getPlanItems,
  hasPlanItem,
  removePlanItem,
  removePlanProduct,
  savePlanItems,
  updatePlanItem,
  upsertPlanItem,
};
