/**
 * 单位转换工具函数
 * 用于销售订单表单中的数量和单价转换
 *
 * 核心原则：
 * 1. 支持片和件两种单位的相互转换
 * 2. 保持计算精度，保留2位小数
 * 3. 纯函数设计，无副作用
 */

/**
 * 数量转换工具
 */
export const convertQuantity = {
  /**
   * 片转件：数量 ÷ 每件片数
   * @param pieces 片数
   * @param piecesPerUnit 每件片数
   * @returns 件数（保留2位小数）
   */
  piecesToUnits: (pieces: number, piecesPerUnit: number): number => {
    if (piecesPerUnit <= 0) {
      return pieces;
    }
    return Math.round((pieces / piecesPerUnit) * 100) / 100;
  },

  /**
   * 件转片：数量 × 每件片数
   * @param units 件数
   * @param piecesPerUnit 每件片数
   * @returns 片数（保留2位小数）
   */
  unitsToPieces: (units: number, piecesPerUnit: number): number => {
    if (piecesPerUnit <= 0) {
      return units;
    }
    return Math.round(units * piecesPerUnit * 100) / 100;
  },

  /**
   * 根据显示单位转换为片数（系统存储单位）
   * @param displayQuantity 显示数量
   * @param displayUnit 显示单位
   * @param piecesPerUnit 每件片数
   * @returns 系统片数
   */
  toSystemQuantity: (
    displayQuantity: number,
    displayUnit: '片' | '件',
    piecesPerUnit: number
  ): number => {
    if (displayUnit === '片') {
      return displayQuantity;
    } else {
      return convertQuantity.unitsToPieces(displayQuantity, piecesPerUnit);
    }
  },

  /**
   * 根据系统片数转换为显示数量
   * @param systemQuantity 系统片数
   * @param displayUnit 显示单位
   * @param piecesPerUnit 每件片数
   * @returns 显示数量
   */
  toDisplayQuantity: (
    systemQuantity: number,
    displayUnit: '片' | '件',
    piecesPerUnit: number
  ): number => {
    if (displayUnit === '片') {
      return systemQuantity;
    } else {
      return convertQuantity.piecesToUnits(systemQuantity, piecesPerUnit);
    }
  },
};

/**
 * 单价转换工具
 */
export const convertUnitPrice = {
  /**
   * 片单价转件单价：片单价 × 每件片数
   * @param piecePrice 片单价
   * @param piecesPerUnit 每件片数
   * @returns 件单价（保留2位小数）
   */
  piecePriceToUnitPrice: (
    piecePrice: number,
    piecesPerUnit: number
  ): number => {
    if (piecesPerUnit <= 0 || piecePrice <= 0) {
      return piecePrice;
    }
    return Math.round(piecePrice * piecesPerUnit * 100) / 100;
  },

  /**
   * 件单价转片单价：件单价 ÷ 每件片数
   * @param unitPrice 件单价
   * @param piecesPerUnit 每件片数
   * @returns 片单价（保留2位小数）
   */
  unitPriceToPiecePrice: (unitPrice: number, piecesPerUnit: number): number => {
    if (piecesPerUnit <= 0 || unitPrice <= 0) {
      return unitPrice;
    }
    return Math.round((unitPrice / piecesPerUnit) * 100) / 100;
  },

  /**
   * 根据单位转换单价（保持总金额不变）
   * @param currentPrice 当前单价
   * @param fromUnit 原单位
   * @param toUnit 目标单位
   * @param piecesPerUnit 每件片数
   * @returns 转换后的单价
   */
  convertPrice: (
    currentPrice: number,
    fromUnit: '片' | '件',
    toUnit: '片' | '件',
    piecesPerUnit: number
  ): number => {
    // 如果单位相同或价格为0，不需要转换
    if (fromUnit === toUnit || currentPrice <= 0 || piecesPerUnit <= 0) {
      return currentPrice;
    }

    if (fromUnit === '片' && toUnit === '件') {
      // 片 → 件：单价 × 每件片数
      return convertUnitPrice.piecePriceToUnitPrice(
        currentPrice,
        piecesPerUnit
      );
    } else if (fromUnit === '件' && toUnit === '片') {
      // 件 → 片：单价 ÷ 每件片数
      return convertUnitPrice.unitPriceToPiecePrice(
        currentPrice,
        piecesPerUnit
      );
    }

    return currentPrice;
  },
};
