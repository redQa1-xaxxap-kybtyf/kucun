/**
 * 分类编码生成工具
 * 将中文分类名称转换为标准的英文编码格式
 */

// 常用分类名称的中英文映射表
const CATEGORY_NAME_MAPPING: Record<string, string> = {
  // 瓷砖相关
  '瓷砖': 'CERAMIC_TILES',
  '地砖': 'FLOOR_TILES',
  '墙砖': 'WALL_TILES',
  '抛光砖': 'POLISHED_TILES',
  '仿古砖': 'ANTIQUE_TILES',
  '木纹砖': 'WOOD_GRAIN_TILES',
  '釉面砖': 'GLAZED_TILES',
  '马赛克': 'MOSAIC_TILES',
  '文化砖': 'CULTURE_TILES',

  // 石材相关
  '石材': 'STONE_MATERIALS',
  '大理石': 'MARBLE',
  '花岗岩': 'GRANITE',
  '人造石': 'ARTIFICIAL_STONE',
  '天然石': 'NATURAL_STONE',

  // 辅材相关
  '辅材': 'AUXILIARY_MATERIALS',
  '水泥': 'CEMENT',
  '砂浆': 'MORTAR',
  '胶水': 'ADHESIVE',
  '填缝剂': 'GROUT',
  '防水材料': 'WATERPROOF_MATERIALS',

  // 工具相关
  '工具': 'TOOLS',
  '切割工具': 'CUTTING_TOOLS',
  '测量工具': 'MEASURING_TOOLS',
  '安装工具': 'INSTALLATION_TOOLS',

  // 通用词汇
  '产品': 'PRODUCTS',
  '材料': 'MATERIALS',
  '设备': 'EQUIPMENT',
  '配件': 'ACCESSORIES',
  '零件': 'PARTS',
  '组件': 'COMPONENTS',
  '系统': 'SYSTEM',
  '服务': 'SERVICE',
  '其他': 'OTHERS',
  '未分类': 'UNCATEGORIZED',
};

// 中文拼音首字母映射表（简化版）
const PINYIN_INITIAL_MAPPING: Record<string, string> = {
  '啊': 'A', '爱': 'A', '安': 'A', '按': 'A',
  '八': 'B', '白': 'B', '办': 'B', '帮': 'B', '包': 'B', '保': 'B', '北': 'B', '本': 'B', '比': 'B', '边': 'B', '表': 'B', '别': 'B', '并': 'B', '不': 'B',
  '才': 'C', '采': 'C', '参': 'C', '层': 'C', '产': 'C', '长': 'C', '常': 'C', '车': 'C', '成': 'C', '程': 'C', '出': 'C', '处': 'C', '传': 'C', '创': 'C', '从': 'C', '存': 'C',
  '大': 'D', '带': 'D', '单': 'D', '当': 'D', '到': 'D', '得': 'D', '的': 'D', '地': 'D', '第': 'D', '点': 'D', '电': 'D', '定': 'D', '东': 'D', '动': 'D', '都': 'D', '对': 'D', '多': 'D',
  '而': 'E', '二': 'E',
  '发': 'F', '法': 'F', '反': 'F', '方': 'F', '放': 'F', '非': 'F', '分': 'F', '风': 'F', '服': 'F', '府': 'F', '复': 'F',
  '该': 'G', '改': 'G', '感': 'G', '干': 'G', '刚': 'G', '高': 'G', '个': 'G', '给': 'G', '根': 'G', '更': 'G', '工': 'G', '公': 'G', '共': 'G', '关': 'G', '管': 'G', '广': 'G', '规': 'G', '国': 'G', '过': 'G',
  '还': 'H', '海': 'H', '好': 'H', '合': 'H', '和': 'H', '很': 'H', '后': 'H', '化': 'H', '话': 'H', '环': 'H', '回': 'H', '会': 'H', '活': 'H', '火': 'H',
  '机': 'J', '基': 'J', '及': 'J', '级': 'J', '即': 'J', '技': 'J', '际': 'J', '加': 'J', '家': 'J', '价': 'J', '间': 'J', '建': 'J', '将': 'J', '交': 'J', '教': 'J', '接': 'J', '结': 'J', '解': 'J', '进': 'J', '经': 'J', '精': 'J', '就': 'J', '具': 'J', '据': 'J', '决': 'J',
  '开': 'K', '看': 'K', '可': 'K', '科': 'K', '客': 'K', '空': 'K', '控': 'K', '口': 'K', '快': 'K',
  '来': 'L', '老': 'L', '了': 'L', '类': 'L', '理': 'L', '里': 'L', '力': 'L', '立': 'L', '利': 'L', '连': 'L', '量': 'L', '两': 'L', '料': 'L', '列': 'L', '流': 'L', '六': 'L', '龙': 'L', '路': 'L', '绿': 'L',
  '马': 'M', '买': 'M', '满': 'M', '没': 'M', '美': 'M', '每': 'M', '门': 'M', '面': 'M', '民': 'M', '明': 'M', '名': 'M', '模': 'M', '目': 'M',
  '那': 'N', '内': 'N', '能': 'N', '你': 'N', '年': 'N', '农': 'N', '女': 'N',
  '欧': 'O',
  '排': 'P', '盘': 'P', '配': 'P', '平': 'P', '品': 'P', '普': 'P',
  '其': 'Q', '期': 'Q', '气': 'Q', '前': 'Q', '强': 'Q', '情': 'Q', '清': 'Q', '区': 'Q', '取': 'Q', '全': 'Q', '确': 'Q', '群': 'Q',
  '然': 'R', '让': 'R', '人': 'R', '认': 'R', '任': 'R', '日': 'R', '如': 'R', '入': 'R',
  '三': 'S', '色': 'S', '设': 'S', '社': 'S', '深': 'S', '生': 'S', '声': 'S', '省': 'S', '时': 'S', '实': 'S', '使': 'S', '始': 'S', '市': 'S', '事': 'S', '手': 'S', '首': 'S', '受': 'S', '数': 'S', '水': 'S', '说': 'S', '思': 'S', '四': 'S', '送': 'S', '苏': 'S', '算': 'S', '所': 'S',
  '他': 'T', '她': 'T', '它': 'T', '台': 'T', '太': 'T', '谈': 'T', '特': 'T', '提': 'T', '体': 'T', '天': 'T', '条': 'T', '听': 'T', '通': 'T', '同': 'T', '头': 'T', '图': 'T', '土': 'T', '团': 'T', '推': 'T',
  '外': 'W', '完': 'W', '万': 'W', '王': 'W', '网': 'W', '往': 'W', '为': 'W', '位': 'W', '文': 'W', '问': 'W', '我': 'W', '无': 'W', '五': 'W', '物': 'W',
  '西': 'X', '系': 'X', '下': 'X', '先': 'X', '现': 'X', '线': 'X', '相': 'X', '想': 'X', '向': 'X', '项': 'X', '小': 'X', '新': 'X', '信': 'X', '行': 'X', '形': 'X', '性': 'X', '修': 'X', '需': 'X', '学': 'X', '选': 'X',
  '压': 'Y', '研': 'Y', '眼': 'Y', '样': 'Y', '要': 'Y', '也': 'Y', '业': 'Y', '一': 'Y', '以': 'Y', '已': 'Y', '意': 'Y', '因': 'Y', '应': 'Y', '用': 'Y', '由': 'Y', '有': 'Y', '又': 'Y', '于': 'Y', '与': 'Y', '元': 'Y', '原': 'Y', '员': 'Y', '月': 'Y', '越': 'Y', '运': 'Y',
  '在': 'Z', '再': 'Z', '造': 'Z', '则': 'Z', '增': 'Z', '展': 'Z', '站': 'Z', '张': 'Z', '找': 'Z', '这': 'Z', '真': 'Z', '正': 'Z', '政': 'Z', '之': 'Z', '知': 'Z', '直': 'Z', '只': 'Z', '制': 'Z', '中': 'Z', '种': 'Z', '重': 'Z', '主': 'Z', '住': 'Z', '注': 'Z', '专': 'Z', '转': 'Z', '装': 'Z', '状': 'Z', '准': 'Z', '资': 'Z', '自': 'Z', '总': 'Z', '组': 'Z', '作': 'Z', '做': 'Z',
};

/**
 * 生成标准的分类编码
 * @param name 分类名称
 * @returns 标准的英文编码
 */
export function generateCategoryCode(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'CATEGORY';
  }

  // 去除首尾空格
  const cleanName = name.trim();

  // 1. 首先检查是否有直接的映射
  if (CATEGORY_NAME_MAPPING[cleanName]) {
    return CATEGORY_NAME_MAPPING[cleanName];
  }

  // 2. 检查是否包含映射表中的关键词
  for (const [chinese, english] of Object.entries(CATEGORY_NAME_MAPPING)) {
    if (cleanName.includes(chinese)) {
      // 如果包含关键词，使用关键词的英文 + 其他部分的处理
      const remaining = cleanName.replace(chinese, '').trim();
      if (remaining) {
        const remainingCode = processRemainingText(remaining);
        return remainingCode ? `${english}_${remainingCode}` : english;
      }
      return english;
    }
  }

  // 3. 处理纯英文名称
  if (/^[a-zA-Z\s\-_0-9]+$/.test(cleanName)) {
    return cleanName
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '')
      .substring(0, 30);
  }

  // 4. 处理中文名称 - 转换为拼音首字母
  const pinyinCode = convertToPinyinInitials(cleanName);
  if (pinyinCode) {
    return pinyinCode;
  }

  // 5. 兜底方案 - 使用数字编码
  return `CATEGORY_${Date.now().toString().slice(-6)}`;
}

/**
 * 处理剩余文本（去除关键词后的部分）
 */
function processRemainingText(text: string): string {
  // 移除特殊字符
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

  if (/^[a-zA-Z0-9]+$/.test(cleaned)) {
    // 纯英文数字
    return cleaned.toUpperCase().substring(0, 15);
  }

  // 中文转拼音首字母
  return convertToPinyinInitials(cleaned);
}

/**
 * 将中文转换为拼音首字母
 */
function convertToPinyinInitials(text: string): string {
  let result = '';

  for (const char of text) {
    if (/[a-zA-Z0-9]/.test(char)) {
      // 英文数字直接添加
      result += char.toUpperCase();
    } else if (/[\u4e00-\u9fa5]/.test(char)) {
      // 中文字符转换为拼音首字母
      const initial = PINYIN_INITIAL_MAPPING[char] || getCharacterInitial(char);
      result += initial;
    }
    // 其他字符忽略
  }

  return result.substring(0, 20) || 'CATEGORY';
}

/**
 * 获取中文字符的拼音首字母（简化版）
 */
function getCharacterInitial(char: string): string {
  const code = char.charCodeAt(0);

  // 基于Unicode编码范围的简单映射
  if (code >= 0x4e00 && code <= 0x4fff) return 'A';
  if (code >= 0x5000 && code <= 0x51ff) return 'B';
  if (code >= 0x5200 && code <= 0x53ff) return 'C';
  if (code >= 0x5400 && code <= 0x55ff) return 'D';
  if (code >= 0x5600 && code <= 0x57ff) return 'E';
  if (code >= 0x5800 && code <= 0x59ff) return 'F';
  if (code >= 0x5a00 && code <= 0x5bff) return 'G';
  if (code >= 0x5c00 && code <= 0x5dff) return 'H';
  if (code >= 0x5e00 && code <= 0x5fff) return 'J';
  if (code >= 0x6000 && code <= 0x61ff) return 'K';
  if (code >= 0x6200 && code <= 0x63ff) return 'L';
  if (code >= 0x6400 && code <= 0x65ff) return 'M';
  if (code >= 0x6600 && code <= 0x67ff) return 'N';
  if (code >= 0x6800 && code <= 0x69ff) return 'P';
  if (code >= 0x6a00 && code <= 0x6bff) return 'Q';
  if (code >= 0x6c00 && code <= 0x6dff) return 'R';
  if (code >= 0x6e00 && code <= 0x6fff) return 'S';
  if (code >= 0x7000 && code <= 0x71ff) return 'T';
  if (code >= 0x7200 && code <= 0x73ff) return 'W';
  if (code >= 0x7400 && code <= 0x75ff) return 'X';
  if (code >= 0x7600 && code <= 0x77ff) return 'Y';
  if (code >= 0x7800 && code <= 0x9fff) return 'Z';

  return 'X'; // 默认返回X
}

/**
 * 确保编码唯一性
 * @param baseCode 基础编码
 * @param existingCodes 已存在的编码列表
 * @returns 唯一的编码
 */
export function ensureUniqueCode(baseCode: string, existingCodes: string[]): string {
  let code = baseCode;
  let counter = 1;

  while (existingCodes.includes(code)) {
    code = `${baseCode}_${counter}`;
    counter++;
  }

  return code;
}

/**
 * 验证编码格式是否符合标准
 * @param code 编码
 * @returns 是否符合标准
 */
export function isValidCategoryCode(code: string): boolean {
  return /^[A-Z0-9_]+$/.test(code) && code.length >= 1 && code.length <= 50;
}
