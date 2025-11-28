import { load } from './htmlParser';
import { BaseScraper } from './BaseScraper';

/**
 * X漫画爬虫实现
 * 网站: xmanhua.com
 */
export class XmanhuaScraper extends BaseScraper {
  constructor() {
    super('https://xmanhua.com');
  }

  /**
   * 获取热门漫画
   */
  async getHotComics(page = 1, limit = 20) {
    return this.getComicsByCategory('31', page, limit);
  }

  /**
   * 获取最新漫画
   */
  async getLatestComics(page = 1, limit = 20) {
    return this.getComicsByCategory('31', page, limit);
  }

  /**
   * 根据分类获取漫画列表
   * URL格式: /manga-list-{category_id}-0-10-p{page}/
   */
  async getComicsByCategory(categoryId, page = 1, limit = 20) {
    try {
      const url = `${this.baseUrl}/manga-list-${categoryId}-0-10-p${page}/`;
      console.log(`请求分类漫画URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const comics = [];

      console.log(`HTML长度: ${response.data.length} 字符`);

      // 获取漫画列表 - 完全按照Python代码的逻辑
      let comicItems = $('ul.mh-list > li');
      console.log(`找到 ul.mh-list > li: ${comicItems.length} 个`);
      
      // 如果第一个选择器没找到，尝试备选
      if (comicItems.length === 0) {
        comicItems = $('ul.mh-list li');
        console.log(`备选: ul.mh-list li: ${comicItems.length} 个`);
      }

      // 遍历漫画项 (限制数量)
      let processedCount = 0;
      comicItems.each((index, item) => {
        if (processedCount >= limit) return false;

        try {
          const $item = $(item);
          
          // 获取链接元素 - 先尝试 div.mh-item > a，如果没有就找第一个a
          let linkElem = $item.find('div.mh-item > a').first();
          if (linkElem.length === 0) {
            linkElem = $item.find('a').first();
          }
          if (linkElem.length === 0) {
            console.log(`  跳过第 ${index + 1} 项: 没有链接`);
            return; // continue
          }

          const href = linkElem.attr('href') || '';
          if (!href) {
            console.log(`  跳过第 ${index + 1} 项: href为空`);
            return;
          }

          // 提取漫画ID - 按Python逻辑: href.strip('/').split('/')[-1]
          const comicId = href.replace(/^\/+|\/+$/g, '').split('/').pop();
          if (!comicId) {
            console.log(`  跳过第 ${index + 1} 项: comicId为空`);
            return;
          }

          // 获取封面
          let imgElem = $item.find('img.mh-cover').first();
          if (imgElem.length === 0) {
            imgElem = $item.find('img').first();
          }
          let cover = imgElem.attr('src') || '';
          if (cover && !cover.startsWith('http')) {
            cover = this.baseUrl + cover;
          }

          // 获取标题
          const titleElem = $item.find('h2.title > a').first();
          let title = titleElem.attr('title') || '';
          if (!title) {
            title = titleElem.text().trim();
          }

          // 获取最新章节
          const chapterElem = $item.find('p.chapter > a').first();
          const latestChapter = chapterElem.text().trim() || '';

          // 只有comicId不为空才添加
          if (comicId) {
            const comicData = {
              id: comicId,
              title,
              cover,
              latestChapter,
              status: 'ongoing',
            };
            comics.push(comicData);
            processedCount++;

            // 前3个打印调试信息
            if (comics.length <= 3) {
              console.log(`漫画 #${comics.length}: ID=${comicId}, 标题=${title}, 封面=${cover.substring(0, 50)}`);
            }
          }
        } catch (error) {
          console.error(`解析单个漫画失败:`, error);
        }
      });

      const hasMore = comicItems.length >= limit;

      return {
        comics,
        hasMore,
        total: comics.length,
      };
    } catch (error) {
      console.error('获取分类漫画失败:', error);
      return { comics: [], hasMore: false, total: 0 };
    }
  }

  /**
   * 搜索漫画
   * URL: /search/?keywords={keyword}
   */
  async searchComics(keyword, page = 1, limit = 20) {
    try {
      const url = `${this.baseUrl}/search/?keywords=${encodeURIComponent(keyword)}`;
      console.log(`搜索漫画URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const comics = [];

      const comicItems = $('ul.mh-list > li');

      comicItems.each((index, element) => {
        if (index >= limit) return false;

        try {
          const $item = $(element);
          const linkElem = $item.find('div.mh-item > a').first();
          const href = linkElem.attr('href') || '';
          const comicId = href.trim().replace(/\//g, '').split('/').pop();

          let cover = $item.find('img').attr('src') || '';
          if (cover && !cover.startsWith('http')) {
            cover = this.baseUrl + cover;
          }

          const title = $item.find('h2.title > a').attr('title') || $item.find('h2.title > a').text().trim() || '';
          const latestChapter = $item.find('p.chapter > a').text().trim() || '';

          if (comicId && title) {
            comics.push({
              id: comicId,
              title,
              cover,
              latestChapter,
              status: 'ongoing',
            });
          }
        } catch (error) {
          console.error('解析搜索结果失败:', error);
        }
      });

      return {
        comics,
        hasMore: false,
        total: comics.length,
      };
    } catch (error) {
      console.error('搜索漫画失败:', error);
      return { comics: [], hasMore: false, total: 0 };
    }
  }

  /**
   * 获取漫画详情
   * URL: /{comic_id}/
   */
  async getComicDetail(comicId) {
    try {
      const url = `${this.baseUrl}/${comicId}/`;
      console.log(`请求详情URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);

      // 获取标题
      let title = $('body > div.detail-info-1 > div > div > p.detail-info-title').text().trim() || $('title').text().trim() || '';

      // 获取封面
      let cover = $('body > div.detail-info-1 > div > div > img.detail-info-cover').attr('src') || $('img.detail-info-cover').attr('src') || '';
      if (cover && !cover.startsWith('http')) {
        cover = this.baseUrl + cover;
      }

      // 获取介绍
      const description = $('body > div.detail-info-2 > div > div > p').text().trim() || $('p.detail-info-tip').text().trim() || '';

      // 获取评分
      const ratingText = $('p.detail-info-stars').text().trim();
      const ratingMatch = ratingText.match(/[\d\.]+/);
      const rating = ratingMatch ? parseFloat(ratingMatch[0]) : 0;

      // 获取作者
      const authorElem = $('p.detail-info-tip > span:nth-child(1)');
      const authorLinks = authorElem.find('a');
      let author = '';
      if (authorLinks.length > 0) {
        const authors = [];
        authorLinks.each((index, elem) => {
          authors.push($(elem).text().trim());
        });
        author = authors.join(', ');
      } else {
        author = authorElem.text().trim().replace('作者：', '');
      }
      if (!author) author = '未知';

      // 获取状态
      const statusText = $('p.detail-info-tip > span:nth-child(2) > span').text().trim();
      let status = 'ongoing';
      if (statusText.includes('已完結') || statusText.includes('完结') || statusText.includes('已完结')) {
        status = 'completed';
      }

      // 获取更新时间
      const detailListTitle = $('div.detail-list-form-title').text().trim();
      let updateTime = '';
      const timeMatch = detailListTitle.match(/(\d{4}-\d{2}-\d{2}|\d+天前|前天|昨天)\s*\d{2}:\d{2}/);
      if (timeMatch) {
        updateTime = timeMatch[0];
      } else {
        const dateMatch = detailListTitle.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          updateTime = dateMatch[0];
        }
      }

      // 从标题中也可以获取状态信息
      if (detailListTitle.includes('連載中') || detailListTitle.includes('连载中')) {
        status = 'ongoing';
      } else if (detailListTitle.includes('已完結') || detailListTitle.includes('完结')) {
        status = 'completed';
      }

      return {
        id: comicId,
        title,
        cover,
        author,
        description,
        status,
        rating,
        categories: [],
        updateTime,
      };
    } catch (error) {
      console.error('获取漫画详情失败:', error);
      return null;
    }
  }

  /**
   * 获取章节列表
   * URL: /{comic_id}/
   * 选择器: #chapterlistload > a
   */
  async getChapters(comicId) {
    try {
      const url = `${this.baseUrl}/${comicId}/`;
      console.log(`请求章节列表URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const chapters = [];

      const chapterItems = $('#chapterlistload > a');

      chapterItems.each((index, element) => {
        const $item = $(element);
        const href = $item.attr('href') || '';
        const title = $item.text().trim();

        // 提取章节ID (例如: /73xm/m80676.html -> m80676)
        const match = href.match(/\/([^\/]+)\.html/);
        const chapterId = match ? match[1] : '';

        if (chapterId) {
          chapters.push({
            id: chapterId,
            title,
            order: index + 1,
            updateTime: '',
          });
        }
      });

      console.log(`成功获取章节列表, 数量: ${chapters.length}`);

      return {
        chapters,
        total: chapters.length,
      };
    } catch (error) {
      console.error('获取章节列表失败:', error);
      return { chapters: [], total: 0 };
    }
  }

  /**
   * 获取章节图片列表
   * URL: /{comic_id}/{chapter_id}.html
   */
  async getChapterImages(chapterId) {
    try {
      // chapterId 格式: comicId/chapterId (例如: 73xm/m80676)
      const url = `${this.baseUrl}/${chapterId}.html`;
      console.log(`请求章节图片URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const images = [];
      
      // 从HTML中提取图片URL
      // X漫画使用JavaScript动态加载图片，需要解析script标签中的数据
      const scriptMatch = response.data.match(/chapterImages\s*=\s*\[(.*?)\]/);
      if (scriptMatch) {
        const imageListStr = scriptMatch[1];
        // 解析图片URL列表
        const imageMatches = imageListStr.matchAll(/"(.*?)"/g);
        for (const match of imageMatches) {
          let imageUrl = match[1];
          if (!imageUrl.startsWith('http')) {
            imageUrl = 'https:' + imageUrl;
          }
          images.push({
            page: images.length + 1,
            url: imageUrl,
          });
        }
      }

      console.log(`成功获取章节图片, 数量: ${images.length}`);

      return {
        images,
        total: images.length,
      };
    } catch (error) {
      console.error('获取章节图片失败:', error);
      return { images: [], total: 0 };
    }
  }

  /**
   * 获取分类列表
   * URL: /manga-list/
   */
  async getCategories() {
    try {
      const url = `${this.baseUrl}/manga-list/`;
      console.log(`请求分类列表URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const categories = [];

      const categoryItems = $('body > div.class-con > div > div:nth-child(1) > a');

      categoryItems.each((index, element) => {
        const $item = $(element);

        // 跳过"全部"等非具体分类
        if ($item.hasClass('active')) {
          return;
        }

        const href = $item.attr('href') || '';
        const name = $item.text().trim();

        if (href && name) {
          // 从URL中提取分类ID (例如: /manga-list-31-0-10-p1/ -> 31)
          const match = href.match(/\/manga-list-(\d+)-/);
          const categoryId = match ? match[1] : '';

          if (categoryId) {
            categories.push({
              id: categoryId,
              name,
              url: this.baseUrl + href,
            });
          }
        }
      });

      return {
        categories,
        total: categories.length,
      };
    } catch (error) {
      console.error('获取分类失败:', error);
      return { categories: [], total: 0 };
    }
  }
}
