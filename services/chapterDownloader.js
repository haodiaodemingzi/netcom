/**
 * 章节下载管理器 - 模仿Python脚本的下载逻辑
 */

class ChapterDownloader {
    constructor() {
        this.cookies = new Map();
        this.downloadQueue = [];
        this.isDownloading = false;
        this.downloadProgress = {
            total: 0,
            completed: 0,
            failed: 0
        };
    }

    /**
     * 获取Cookie - 模仿Python脚本的get_cookies_and_headers函数
     */
    async getCookies(cookieUrls) {
        console.log('1. 正在获取Cookie...');
        
        try {
            // 访问主页获取基础Cookie
            console.log('2. 访问主页获取基础Cookie...');
            await fetch(cookieUrls[0], {
                method: 'GET',
                credentials: 'include', // 重要：包含Cookie
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
                }
            });

            // 访问章节页面获取更多Cookie
            if (cookieUrls.length > 1) {
                console.log('3. 访问章节页面获取更多Cookie...');
                await fetch(cookieUrls[1], {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Referer': cookieUrls[0]
                    }
                });
            }

            console.log('4. Cookie获取成功');
            return true;
        } catch (error) {
            console.error('获取Cookie失败:', error);
            return false;
        }
    }

    /**
     * 下载单张图片
     */
    async downloadImage(imageInfo, headers, onProgress) {
        try {
            console.log(`开始下载第${imageInfo.page}页...`);

            const response = await fetch(imageInfo.url, {
                method: 'GET',
                credentials: 'include', // 重要：包含Cookie
                headers: {
                    ...headers,
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // 生成文件名
            const filename = `page_${String(imageInfo.page).padStart(3, '0')}.jpg`;
            a.download = filename;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            console.log(`第${imageInfo.page}页下载成功: ${filename}`);
            
            if (onProgress) {
                onProgress({
                    page: imageInfo.page,
                    status: 'success',
                    filename: filename
                });
            }

            return { success: true, page: imageInfo.page, filename };

        } catch (error) {
            console.error(`第${imageInfo.page}页下载失败:`, error);
            
            if (onProgress) {
                onProgress({
                    page: imageInfo.page,
                    status: 'error',
                    error: error.message
                });
            }

            return { success: false, page: imageInfo.page, error: error.message };
        }
    }

    /**
     * 下载整个章节
     */
    async downloadChapter(chapterId, source = 'xmanhua', onProgress = null) {
        if (this.isDownloading) {
            throw new Error('已有下载任务在进行中');
        }

        this.isDownloading = true;
        this.downloadProgress = { total: 0, completed: 0, failed: 0 };

        try {
            // 1. 获取章节下载信息
            const apiUrl = `/api/chapters/${chapterId}/download-info?source=${source}`;
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || '获取章节信息失败');
            }

            const { images, download_config } = data.data;
            this.downloadProgress.total = images.length;

            console.log(`章节包含 ${images.length} 张图片`);

            // 2. 获取Cookie
            const cookieSuccess = await this.getCookies(download_config.cookie_urls);
            if (!cookieSuccess) {
                throw new Error('获取Cookie失败');
            }

            // 3. 下载所有图片
            console.log('开始下载图片...');
            const results = [];

            for (let i = 0; i < images.length; i++) {
                const imageInfo = images[i];
                
                // 添加延迟避免请求过快
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const result = await this.downloadImage(
                    imageInfo, 
                    download_config.headers,
                    (progress) => {
                        if (progress.status === 'success') {
                            this.downloadProgress.completed++;
                        } else if (progress.status === 'error') {
                            this.downloadProgress.failed++;
                        }

                        if (onProgress) {
                            onProgress({
                                ...progress,
                                total: this.downloadProgress.total,
                                completed: this.downloadProgress.completed,
                                failed: this.downloadProgress.failed,
                                percentage: Math.round((this.downloadProgress.completed + this.downloadProgress.failed) / this.downloadProgress.total * 100)
                            });
                        }
                    }
                );

                results.push(result);
            }

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            console.log(`下载完成! 成功: ${successCount}, 失败: ${failCount}`);

            return {
                success: true,
                total: images.length,
                successCount,
                failCount,
                results
            };

        } catch (error) {
            console.error('章节下载失败:', error);
            throw error;
        } finally {
            this.isDownloading = false;
        }
    }

    /**
     * 获取下载进度
     */
    getProgress() {
        return { ...this.downloadProgress };
    }

    /**
     * 是否正在下载
     */
    isDownloadInProgress() {
        return this.isDownloading;
    }
}

// 导出单例
const chapterDownloader = new ChapterDownloader();
export default chapterDownloader;
