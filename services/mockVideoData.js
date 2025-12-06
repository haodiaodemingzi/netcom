// Mock 短剧数据

// 视频分类
export const mockVideoCategories = [
  { id: 'hot', name: '热门' },
  { id: 'latest', name: '最新' },
  { id: 'romance', name: '爱情' },
  { id: 'comedy', name: '喜剧' },
  { id: 'drama', name: '剧情' },
  { id: 'fantasy', name: '奇幻' },
  { id: 'action', name: '动作' },
];

// 视频数据源
export const mockVideoSources = {
  'source1': {
    name: '视频源1',
    description: '默认视频数据源',
  },
  'source2': {
    name: '视频源2',
    description: '备用视频数据源',
  },
};

export const mockSeriesList = [
  {
    id: 'series_001',
    title: '逆袭人生',
    cover: 'https://via.placeholder.com/200x300?text=逆袭人生',
    description: '一个普通上班族的逆袭之路，从底层员工到公司高管',
    rating: 8.5,
    episodes: 12,
    status: '完结',
    category: 'drama',
    source: 'source1',
  },
  {
    id: 'series_002',
    title: '爱情公寓',
    cover: 'https://via.placeholder.com/200x300?text=爱情公寓',
    description: '五个年轻人在公寓里发生的爆笑故事',
    rating: 8.2,
    episodes: 24,
    status: '连载中',
    category: 'comedy',
    source: 'source1',
  },
  {
    id: 'series_003',
    title: '重生之我是富二代',
    cover: 'https://via.placeholder.com/200x300?text=重生富二代',
    description: '穿越到富二代身体，开启新的人生',
    rating: 7.8,
    episodes: 18,
    status: '完结',
    category: 'fantasy',
    source: 'source1',
  },
  {
    id: 'series_004',
    title: '校园恋爱日记',
    cover: 'https://via.placeholder.com/200x300?text=校园恋爱',
    description: '高中生的青春爱情故事',
    rating: 7.5,
    episodes: 15,
    status: '完结',
    category: 'romance',
    source: 'source1',
  },
  {
    id: 'series_005',
    title: '霸道总裁爱上我',
    cover: 'https://via.placeholder.com/200x300?text=霸道总裁',
    description: '职场女强人与霸道总裁的甜蜜爱情',
    rating: 8.0,
    episodes: 20,
    status: '完结',
    category: 'romance',
    source: 'source1',
  },
  {
    id: 'series_006',
    title: '都市修仙传',
    cover: 'https://via.placeholder.com/200x300?text=都市修仙',
    description: '现代都市中的修仙者传奇',
    rating: 7.9,
    episodes: 30,
    status: '连载中',
    category: 'fantasy',
    source: 'source1',
  },
  {
    id: 'series_007',
    title: '爆笑办公室',
    cover: 'https://via.placeholder.com/200x300?text=爆笑办公室',
    description: '办公室里的搞笑日常',
    rating: 8.3,
    episodes: 16,
    status: '完结',
    category: 'comedy',
    source: 'source1',
  },
  {
    id: 'series_008',
    title: '特工行动',
    cover: 'https://via.placeholder.com/200x300?text=特工行动',
    description: '特工执行秘密任务的惊险故事',
    rating: 8.1,
    episodes: 22,
    status: '完结',
    category: 'action',
    source: 'source1',
  },
];

const VIDEO_URL = 'https://live-s3m.mediav.com/nativevideo/9f39822f82588713a0ee52e9dbd5f75b-bit_zdgq768.mp4';

export const mockEpisodes = {
  series_001: [
    {
      id: 'ep_001_001',
      seriesId: 'series_001',
      title: '第1集 被裁员',
      duration: 600,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第1集',
      description: '主角在公司被无情裁员，人生陷入低谷',
    },
    {
      id: 'ep_001_002',
      seriesId: 'series_001',
      title: '第2集 重新开始',
      duration: 580,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第2集',
      description: '决定重新开始，参加培训班学习新技能',
    },
    {
      id: 'ep_001_003',
      seriesId: 'series_001',
      title: '第3集 机会来临',
      duration: 620,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第3集',
      description: '一个意外的机会改变了他的人生轨迹',
    },
    {
      id: 'ep_001_004',
      seriesId: 'series_001',
      title: '第4集 职场博弈',
      duration: 610,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第4集',
      description: '在新公司展开激烈的职场竞争',
    },
  ],
  series_002: [
    {
      id: 'ep_002_001',
      seriesId: 'series_002',
      title: '第1集 新室友',
      duration: 550,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第1集',
      description: '五个陌生人成为室友，开启爆笑日常',
    },
    {
      id: 'ep_002_002',
      seriesId: 'series_002',
      title: '第2集 厨房大战',
      duration: 570,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第2集',
      description: '为了厨房使用权的爆笑争执',
    },
  ],
  series_003: [
    {
      id: 'ep_003_001',
      seriesId: 'series_003',
      title: '第1集 穿越',
      duration: 630,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第1集',
      description: '一场意外让他穿越到富二代身体',
    },
  ],
  series_004: [
    {
      id: 'ep_004_001',
      seriesId: 'series_004',
      title: '第1集 初恋',
      duration: 540,
      videoUrl: VIDEO_URL,
      thumbnail: 'https://via.placeholder.com/160x90?text=第1集',
      description: '高中生的初恋故事开始',
    },
  ],
};

export const mockPlaybackProgress = {
  ep_001_001: {
    episodeId: 'ep_001_001',
    seriesId: 'series_001',
    currentTime: 120,
    duration: 600,
    lastWatchedAt: new Date().toISOString(),
  },
  ep_002_001: {
    episodeId: 'ep_002_001',
    seriesId: 'series_002',
    currentTime: 300,
    duration: 550,
    lastWatchedAt: new Date().toISOString(),
  },
};
