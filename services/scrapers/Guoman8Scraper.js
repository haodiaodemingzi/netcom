import { load } from './htmlParser';
import { BaseScraper } from './BaseScraper';

/**
 * 国漫8爬虫实现
 * 网站: guoman8.cc
 */
export class Guoman8Scraper extends BaseScraper {
  constructor() {
    super('https://www.guoman8.cc');
  }

  /**
   * 获取热门漫画
   */
  async getHotComics(page = 1, limit = 20) {
    return this.getComicsByCategory('1', page, limit);
  }

  /**
   * 获取最新漫画
   */
  async getLatestComics(page = 1, limit = 20) {
    return this.getComicsByCategory('2', page, limit);
  }

  /**
   * 根据分类获取漫画列表
   * URL格式: /list/smid-{category_id}-p-{page}
   */
  async getComicsByCategory(categoryId, page = 1, limit = 20) {
    try {
      // 构建URL
      let url;
      if (page === 1) {
        url = `${this.baseUrl}/list/smid-${categoryId}`;
      } else {
        url = `${this.baseUrl}/list/smid-${categoryId}-p-${page}`;
      }

      console.log(`请求分类漫画URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const comics = [];

      // 获取漫画列表
      const comicItems = $('#contList > li');

      comicItems.each((index, element) => {
        try {
          const $item = $(element);

          // 获取链接
          const link = $item.find('a.bcover');
          if (!link.length) return;

          const href = link.attr('href') || '';

          // 提取漫画ID (例如: /44958/ -> 44958)
          const match = href.match(/\/(\d+)\//);
          if (!match) return;

          const comicId = match[1];

          // 获取封面
          const img = link.find('img');
          let cover = img.attr('src') || '';
          if (cover && !cover.startsWith('http')) {
            cover = this.baseUrl + cover;
          }

          // 获取标题
          const titleElem = $item.find('dt');
          const title = titleElem.text().trim() || '';

          // 获取最新章节
          const latestElem = $item.find('dd.tags');
          const latestChapter = latestElem.text().trim() || '';

          if (comicId && title) {
            comics.push({
              id: comicId,
              title,
              cover,
              latestChapter,
              status: 'ongoing',
              updateTime: '',
            });
          }
        } catch (error) {
          console.error('解析漫画项失败:', error);
        }
      });

      // 检查是否有下一页
      const pager = $('div.book-list div.pager');
      const hasMore = pager.find('a:contains("下一页")').length > 0;

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
   * URL: /search/{keyword}-p-{page}
   */
  async searchComics(keyword, page = 1, limit = 20) {
    try {
      let url = `${this.baseUrl}/search/${encodeURIComponent(keyword)}`;
      if (page > 1) {
        url += `-p-${page}`;
      }

      console.log(`搜索漫画URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const comics = [];

      const comicItems = $('#contList > li');

      comicItems.each((index, element) => {
        try {
          const $item = $(element);
          const link = $item.find('a.bcover');
          if (!link.length) return;

          const href = link.attr('href') || '';
          const match = href.match(/\/(\d+)\//);
          if (!match) return;

          const comicId = match[1];

          const img = link.find('img');
          let cover = img.attr('src') || '';
          if (cover && !cover.startsWith('http')) {
            cover = this.baseUrl + cover;
          }

          const titleElem = $item.find('dt');
          const title = titleElem.text().trim() || '';

          if (comicId && title) {
            comics.push({
              id: comicId,
              title,
              cover,
              latestChapter: '',
              status: 'ongoing',
            });
          }
        } catch (error) {
          console.error('解析搜索结果失败:', error);
        }
      });

      return {
        comics,
        hasMore: comics.length >= limit,
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

      // 获取封面
      const coverImg = $('div.book-cover.fl > p > img');
      let cover = coverImg.attr('src') || '';
      if (cover && !cover.startsWith('http')) {
        cover = this.baseUrl + cover;
      }

      // 获取详情
      const detailDiv = $('div.book-detail.pr.fr');

      let title = '';
      let author = '';
      let description = '';
      let status = 'ongoing';
      const categories = [];

      if (detailDiv.length) {
        // 标题
        const titleElem = detailDiv.find('h1');
        title = titleElem.text().trim() || '';

        // 作者和状态
        const infoList = detailDiv.find('li');
        infoList.each((index, element) => {
          const text = $(element).text().trim();

          if (text.includes('作者')) {
            author = text.replace('作者:', '').trim();
          } else if (text.includes('状态')) {
            if (text.includes('完结')) {
              status = 'completed';
            }
          } else if (text.includes('类型') || text.includes('题材')) {
            // 提取分类
            $(element)
              .find('a')
              .each((idx, elem) => {
                categories.push($(elem).text().trim());
              });
          }
        });

        // 简介
        const introDiv = detailDiv.find('div.intro');
        description = introDiv.text().trim() || '';
      }

      return {
        id: comicId,
        title,
        cover,
        author,
        description,
        status,
        categories,
        rating: 0,
        updateTime: '',
      };
    } catch (error) {
      console.error('获取漫画详情失败:', error);
      return null;
    }
  }

  /**
   * 获取章节列表
   * URL: /{comic_id}/
   * 选择器: #chpater-list-1 > ul > li
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

      const chapterUl = $('#chpater-list-1 > ul');

      if (chapterUl.length) {
        const liItems = chapterUl.find('li');

        liItems.each((index, element) => {
          const $item = $(element);
          const link = $item.find('a');

          if (link.length) {
            const href = link.attr('href') || '';
            const title = link.text().trim();

            // 提取章节ID (例如: /45043/01.html -> 45043_01)
            const match = href.match(/\/(\d+)\/([^/]+)\.html/);
            if (match) {
              const chapterId = `${match[1]}_${match[2]}`;

              chapters.push({
                id: chapterId,
                title,
                order: index + 1,
                updateTime: '',
                isRead: false,
              });
            }
          }
        });
      }

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
   * URL: /{comic_id}/{chapter_num}.html
   */
  async getChapterImages(chapterId) {
    try {
      // 解析chapter_id (格式: 45043_01)
      const parts = chapterId.split('_');
      if (parts.length !== 2) {
        return { images: [], total: 0 };
      }

      const [comicId, chapterNum] = parts;
      const url = `${this.baseUrl}/${comicId}/${chapterNum}.html`;

      console.log(`请求章节图片URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      // 从HTML中提取图片URL
      const images = this.extractImagesFromJs(response.data);

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
   * 从JavaScript代码中提取图片URL
   */
  extractImagesFromJs(html) {
    try {
      // 方法1: 查找直接的图片URL模式
      const imgPattern = /https?:\/\/[^\s'"]+\.(?:jpg|jpeg|png|gif|webp)/gi;
      const imgUrls = html.match(imgPattern) || [];

      const images = [];
      const uniqueUrls = [...new Set(imgUrls)]; // 去重

      uniqueUrls.forEach((url, index) => {
        images.push({
          page: index + 1,
          url,
        });
      });

      if (images.length > 0) {
        return images;
      }

      // 方法2: 查找图片数组 'B':['url1','url2']
      const arrayPattern = /'B'\s*:\s*\[(.*?)\]/s;
      const arrayMatch = html.match(arrayPattern);

      if (arrayMatch) {
        const urlsStr = arrayMatch[1];
        const urlPattern = /'(https?:\/\/[^']+)'/g;
        let match;

        while ((match = urlPattern.exec(urlsStr)) !== null) {
          images.push({
            page: images.length + 1,
            url: match[1],
          });
        }
      }

      return images;
    } catch (error) {
      console.error('提取图片URL失败:', error);
      return [];
    }
  }

  /**
   * 获取分类列表
   * URL: / (首页)
   */
  async getCategories() {
    try {
      const url = this.baseUrl;
      console.log(`请求分类列表URL: ${url}`);

      const response = await this.makeRequest(url, {
        headers: {
          'Referer': this.baseUrl,
        },
      });

      const $ = load(response.data);
      const categories = [];

      const genreUl = $('div.filter.genre > ul');

      if (genreUl.length) {
        const liItems = genreUl.find('li');

        liItems.each((index, element) => {
          const $item = $(element);
          const link = $item.find('a');

          if (link.length) {
            const href = link.attr('href') || '';
            const name = link.text().trim();

            // 提取分类ID (例如: /list/smid-1 -> 1)
            const match = href.match(/smid-(\d+)/);
            if (match) {
              const categoryId = match[1];
              categories.push({
                id: categoryId,
                name,
                url: this.baseUrl + href,
              });
            }
          }
        });
      }

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
