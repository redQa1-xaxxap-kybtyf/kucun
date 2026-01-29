export type PinyinUtils = {
  chineseToPinyinUppercase: (text: string) => string;
  chineseToPinyinInitialsUppercase: (text: string) => string;
};

let cachedPromise: Promise<PinyinUtils> | null = null;

export function isPinyinSearchQuery(query: string): boolean {
  return /[a-z]/i.test(query);
}

export async function loadPinyinUtils(): Promise<PinyinUtils> {
  if (!cachedPromise) {
    cachedPromise = import('./pinyin')
      .then(mod => ({
        chineseToPinyinUppercase: mod.chineseToPinyinUppercase,
        chineseToPinyinInitialsUppercase: mod.chineseToPinyinInitialsUppercase,
      }))
      .catch(error => {
        cachedPromise = null;
        throw error;
      });
  }

  return cachedPromise;
}

