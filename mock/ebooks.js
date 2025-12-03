export const ebookSources = {
  localMock: {
    id: 'localMock',
    name: '示例采集源',
    description: '本地 Mock 数据源，模拟分类、书籍与章节结构',
  },
};

export const ebookCategories = [
  { id: 'wuxia', name: '武侠' },
  { id: 'qihuan', name: '奇幻' },
  { id: 'history', name: '历史' },
  { id: 'romance', name: '言情' },
];

export const ebookList = [
  {
    id: 'ebook-1',
    title: '大荒武侠志',
    author: '南山居士',
    cover:
      'https://dummyimage.com/400x560/7b61ff/ffffff&text=%E5%A4%A7%E8%8D%92%E6%AD%A6%E4%BE%A0%E5%BF%97',
    status: 'serializing',
    category: 'wuxia',
    description:
      '边荒少年意外卷入宗门纷争，开启一段关于责任、牺牲与成长的传奇旅程。',
    wordCount: '58万',
    lastUpdated: '2025-02-10T12:00:00Z',
    latestChapter: {
      id: 'ebook-1-ch-35',
      title: '第三十五章 霜雪刀鸣',
    },
  },
  {
    id: 'ebook-2',
    title: '星海采药人',
    author: '青岚',
    cover:
      'https://dummyimage.com/400x560/ff8a65/ffffff&text=%E6%98%9F%E6%B5%B7%E9%87%87%E8%8D%AF%E4%BA%BA',
    status: 'completed',
    category: 'qihuan',
    description:
      '穿梭宇宙的采药人记录万千文明奇花异草，重新定义能量与生命的边界。',
    wordCount: '73万',
    lastUpdated: '2024-11-28T08:00:00Z',
    latestChapter: {
      id: 'ebook-2-ch-52',
      title: '终章 群星回响',
    },
  },
  {
    id: 'ebook-3',
    title: '长安旧梦录',
    author: '白落梅',
    cover:
      'https://dummyimage.com/400x560/4db6ac/ffffff&text=%E9%95%BF%E5%AE%89%E6%97%A7%E6%A2%A6%E5%BD%95',
    status: 'serializing',
    category: 'history',
    description:
      '以长安少女的视角，重现盛唐市井百态与家国抉择，串联十年风云。',
    wordCount: '41万',
    lastUpdated: '2025-01-15T19:00:00Z',
    latestChapter: {
      id: 'ebook-3-ch-27',
      title: '第二十七章 夜谈玄武门',
    },
  },
];

export const ebookChapters = {
  'ebook-1': Array.from({ length: 35 }).map((_, index) => ({
    id: `ebook-1-ch-${index + 1}`,
    title: `第${index + 1}章 · ${['霜雪', '星火', '暮色', '孤灯'][index % 4]}余音`,
    updatedAt: '2025-02-10T12:00:00Z',
    wordCount: `${2.5 + index * 0.1}k`,
  })),
  'ebook-2': Array.from({ length: 52 }).map((_, index) => ({
    id: `ebook-2-ch-${index + 1}`,
    title: `第${index + 1}章 · 星尘札记`,
    updatedAt: '2024-11-28T08:00:00Z',
    wordCount: `${2.2 + index * 0.08}k`,
  })),
  'ebook-3': Array.from({ length: 27 }).map((_, index) => ({
    id: `ebook-3-ch-${index + 1}`,
    title: `第${index + 1}章 · 长安夜话`,
    updatedAt: '2025-01-15T19:00:00Z',
    wordCount: `${2.0 + index * 0.05}k`,
  })),
};

export const ebookChapterContent = (chapterId) => {
  return `【章节 ${chapterId}】\n\n在尚未接通真实数据之前，这里展示的是本地 mock 文本。\n你可以在阅读器中实现字体、背景、分页等交互，也可以在此处挂载下载入口。\n\n后续接入真实采集源后，只需要替换获取章节文本的 API 调用，无需调整前端结构。`;
};

export const getBooksByCategory = (categoryId) => {
  if (!categoryId || categoryId === 'all') {
    return ebookList;
  }
  return ebookList.filter((book) => book.category === categoryId);
};

export const getBookById = (id) => ebookList.find((book) => book.id === id);

