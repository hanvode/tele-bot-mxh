import axios from 'axios';
import * as path from 'path';
import * as winston from 'winston';
import { IGetWeiboLongTextParams, IGetWeiboParams, IWeiboAPIResponse, IWeiboLongTextResponse, IWeiboPost } from './type';

export const blackWords: string[] = process.env.BLACK_WORDS ? process.env.BLACK_WORDS.split(',') : [];
export const whiteWords: string[] = process.env.WHITE_WORDS ? process.env.WHITE_WORDS.split(',') : [];

class APIMonitor {
    private logger!: winston.Logger;
    private checkInterval: number;
    private telegramChatId: string;
    private proxyURL: string;
    // private mapIdNew: Map<string, APIData>;

    constructor(
        private telegramBotToken: string,
        telegramChatId: string,
        proxyURL: string,
        checkInterval: number = 60
    ) {
        this.telegramChatId = telegramChatId;
        this.proxyURL = proxyURL;
        this.checkInterval = checkInterval * 1000; // Convert to milliseconds
        // this.mapIdNew = new Map<string, APIData>();

        this.setupLogging();
    }

    private setupLogging(): void {
        // Use a specific file path
        const logPath = path.resolve('./logs/api_monitor.log');

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf((info: winston.Logform.TransformableInfo) => {
                    return `${info.timestamp} - ${info.level}: ${info.message}`;
                })
            ),
            transports: [
                new winston.transports.File({
                    filename: logPath,
                }),
                new winston.transports.Console()
            ]
        });
    }

    public async getUserWeiboPosts(params: IGetWeiboParams): Promise<IWeiboAPIResponse> {
        const url = 'https://weibo.com/ajax/statuses/mymblog';

        try {
            this.logger.info(`Fetching Weibo posts for UID: ${params.uid}`);

            const response = await axios.get(url, {
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                    'client-version': 'v2.47.83',
                    'cookie': 'XSRF-TOKEN=lNQFjuUpzY0uClYggP13l8Be; SUB=_2AkMfOob3f8NxqwFRmvkSyGjkbotwyQnEieKpZncsJRMxHRl-yT9kqmAMtRB6NLqoGKiCeNmxLiqQEvrJ1Ds7VgzqPOjd; SUBP=0033WrSXqPxfM72-Ws9jqgMF55529P9D9WWxh-Yk6bdT8Niqx8D5fM0f; WBPSESS=LKUy5Npwn5zVNZX-hrYAMLnPdic7E60uRFHlXcgcPFd8j9CD6QNWVmdjeClbxFh8SHikk1abC2pyIjZIb3PLMg5LNkrzDK4zDkz6LSW4jE2yUsbvL3IeoorjGR_rT_EVGzPtskTWkDVD49YEAXNywOjZKzYf0-g1_hyztSIzWPY=; XSRF-TOKEN=xwGn5-7kIrL9bVoHNgXFApFx; WBPSESS=LKUy5Npwn5zVNZX-hrYAMLnPdic7E60uRFHlXcgcPFetuJRIaBEBfri7rwwMvO4Plu4lQQCUfj1xJuXYcs-vbYIpeYh0drXUfEj4DiWjFW9gzNVqwaV4AUT2mR3A0_Xr',
                    'referer': `https://weibo.com/u/${params.uid}`,
                    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'x-requested-with': 'XMLHttpRequest',
                    'x-xsrf-token': 'lNQFjuUpzY0uClYggP13l8Be'
                },
                params: {
                    uid: params.uid,
                    page: params.page,
                    feature: params.feature
                },
                timeout: 60000
            });
            return response.data.data;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error fetching Weibo API: ${errorMessage}`);
            return {};
        }
    }

    public async getDetailLongTextPost(params: IGetWeiboLongTextParams): Promise<IWeiboLongTextResponse> {
        const url = `https://weibo.com/ajax/statuses/longtext`;

        try {
            this.logger.info(`Fetching Weibo longtext for post ID: ${params.id}`);

            const response = await axios.get(url, {
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                    'client-version': 'v2.47.83',
                    'cookie': 'XSRF-TOKEN=lNQFjuUpzY0uClYggP13l8Be; SUB=_2AkMfOob3f8NxqwFRmvkSyGjkbotwyQnEieKpZncsJRMxHRl-yT9kqmAMtRB6NLqoGKiCeNmxLiqQEvrJ1Ds7VgzqPOjd; SUBP=0033WrSXqPxfM72-Ws9jqgMF55529P9D9WWxh-Yk6bdT8Niqx8D5fM0f; WBPSESS=LKUy5Npwn5zVNZX-hrYAMLnPdic7E60uRFHlXcgcPFetuJRIaBEBfri7rwwMvO4Pys5shGUs2VD11dlVkZ50IlNrlLxE4eb5NANlxUz2nZZShY998NUaLcH8NG2-2X_d',
                    'referer': `https://weibo.com/u/${params.refererUid}`,
                    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'x-requested-with': 'XMLHttpRequest',
                    'x-xsrf-token': 'lNQFjuUpzY0uClYggP13l8Be'
                },
                params: {
                    id: params.id
                },
                timeout: 30000
            });

            return response.data.data;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error fetching longtext API: ${errorMessage}`);
            return { longTextContent: '' };
        }
    }


    // get data weibo post today
    private async getDataWeiboPost(id: string): Promise<IWeiboPost[]> {
        const timePeriod = parseInt(process.env.CHECK_INTERVAL || "3600", 10);
        const now = new Date();
        const thresholdTime = new Date(now.getTime() - timePeriod * 1000);
        const newPosts: IWeiboPost[] = []
        let isContinuePost = true;
        let start = 1;
        while (isContinuePost) {
            const weiboPosts = await this.getUserWeiboPosts({
                uid: id,
                page: start,
                feature: 0
            });
            if (!weiboPosts?.list || weiboPosts?.list?.length === 0) break;
            for (const newData of weiboPosts.list) {
                const postTime = new Date(newData.created_at);
                // Nếu bài viết (không phải bài ghim) cũ hơn khoảng thời gian kiểm tra => dừng luôn
                if (postTime < thresholdTime) {
                    if (newData.isTop) continue;
                    isContinuePost = false;
                    break;
                }


                let longText = newData.text_raw;
                if (newData.isLongText) {
                    const longTextData = await this.getDetailLongTextPost({
                        id: newData.mblogid,
                        refererUid: id
                    })
                    longText = longTextData.longTextContent;
                }

                // Nếu có danh sách từ cấm, kiểm tra trước
                if (blackWords.length > 0) {
                    const hasBlackWord = blackWords.some((word) => longText.includes(word));
                    if (hasBlackWord) {
                        // Có chứa từ cấm thì bỏ qua luôn
                        continue;
                    }
                }


                // Nếu có danh sách từ trắng, chỉ hiển thị nếu khớp ít nhất 1 từ
                if (whiteWords.length > 0) {
                    const hasWhiteWord = whiteWords.some((word) => longText.includes(word));
                    if (!hasWhiteWord) continue;
                }

                newPosts.push({
                    text_raw: longText,
                    created_at: postTime.toISOString(),
                    idstr: newData.idstr,
                    mblogid: newData.mblogid,
                    isLongText: newData.isLongText,
                    isTop: newData.isTop
                });

            }
            start += 1;

        }
        return newPosts;
    }

    /**
   * Lấy chuỗi ngày theo định dạng YYYY-MM-DD
   */
    private getDateString(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    private async translateViaProxy(text: string): Promise<string> {
        try {
            const response = await axios.post('https://translate.nhachoc1999.workers.dev', {
                q: text,
                from: 'zh-CN',
                to: 'vi'
            });

            return response.data.translatedText;
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error('❌ Lỗi dịch qua proxy:', errMsg);
            return text; // fallback
        }
    }



    private async translateMultiline(text: string): Promise<string> {
        if (!text) return '';
        const segments = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

        const translatedLines: string[] = [];
        const batchSize = 5; // Số dòng mỗi batch
        const separator = '|||'; // Dùng để tách các dòng trong batch

        for (let i = 0; i < segments.length; i += batchSize) {
            const batch = segments.slice(i, i + batchSize);
            const batchText = batch.join(`\n${separator}\n`);

            try {
                const translatedBatch = await this.translateViaProxy(batchText);
                const lines = translatedBatch.split(separator).map(l => l.trim());
                // Nếu số dòng dịch ra khớp, dùng luôn
                if (lines.length === batch.length) {
                    translatedLines.push(...lines);
                } else {
                    console.warn(`⚠️ Số dòng dịch không khớp batch (${i}): fallback về bản gốc`);
                    translatedLines.push(...batch);
                }

            } catch (error: unknown) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Lỗi dịch batch tại dòng ${i}:`, errMsg);
                translatedLines.push(...batch); // fallback nếu lỗi
            }
        }

        return translatedLines.join('\n');
    }

    private splitMessage(message: string, maxLength = 3000): string[] {
        let parts = [];
        for (let i = 0; i < message.length; i += maxLength) {
            parts.push(message.slice(i, i + maxLength));
        }
        return parts;
    }

    private async sendTelegramMessage(message: string): Promise<void> {
        try {
            const parts = this.splitMessage(message);
            const url = `${this.proxyURL}/bot${this.telegramBotToken}/sendMessage`;

            for (let part of parts) {
                const response = await axios.post(url, {
                    chat_id: Number(this.telegramChatId),
                    text: part,
                    parse_mode: 'HTML'
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                this.logger.info("✅ Telegram notification sent successfully", response.data);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error sending Telegram message: ${errorMessage}`);
        }
    }

    /*
    Note task:
    1. Lấy dữ liệu gửi theo mới nhất, không lấy lặp
    2. Dịch nội dung bài viết theo các từ khoá có thể có trong .env bao gồm từ cấm (black_list) và từ lọc (white_list)
    3. Gửi telegram theo định dạng rõ ràng hơn
    */


    private async handleBuildMessage(newData: IWeiboPost[], user: { name: string; posts: IWeiboPost[]; }): Promise<string> {
        let messageString: string = '';
        if (newData.length > 0) {
            const now = new Date();
            const currentDate = this.getDateString(now);
            messageString += `🌐 Người dùng: ${user.name} có ${newData.length} tin mới ngày ${currentDate}\n\n`
            let stt = 1;
            for (let i = newData.length - 1; i >= 0; i--) {
                const post = newData[i];
                messageString += `${stt}. ⏰ Thời gian: ${post.created_at} (giờ Trung Quốc)\n` +
                    `📝 Nội dung bài:\n${(await this.translateMultiline(post.text_raw || ''))}\n\n`;
                stt++;
            }
        }
        return messageString;
    }

    public async monitorApi(apiUrl: string, mapUserWeibo: Map<string, { name: string; posts: IWeiboPost[] }>): Promise<void> {
        this.logger.info(`Starting to monitor API: ${apiUrl}`);
        setInterval(async () => {
            try {
                this.logger.info("Checking API for changes...");
                // Lọc qua từng tài khoản weibo
                for (const [id, user] of mapUserWeibo) {
                    // B1: Lấy dữ liệu gửi theo mới nhất, không lấy lặp
                    const weiboPosts = await this.getDataWeiboPost(id);
                    // B2: Chuyển dữ liệu sang dạng message cho telegram
                    const messageUser = await this.handleBuildMessage(weiboPosts, user);
                    // B3: Gửi telegram
                    await this.sendTelegramMessage(messageUser);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`An error occurred: ${errorMessage}`);
            }
        }, this.checkInterval);

        // Keep the process running
        this.logger.info("API monitor is now running. Press Ctrl+C to exit.");
    }
}

async function main() {
    const PROXY_URL = process.env.PROXY_URL || '';
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
    const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || "3600", 10);
    const API_URL = process.env.API_URL || '';

    const mapUserWeibo = new Map<string, { name: string; posts: IWeiboPost[] }>();
    const weiboAcoounts = process.env.WEIBO_ACCOUNTS;
    if (weiboAcoounts) {
        weiboAcoounts.split(',').forEach((account: string) => {
            const [id, name] = account.split(':').map((item) => item.trim());
            if (id && name) {
                mapUserWeibo.set(id, { name, posts: [] });
            }
        })
    }

    const monitor = new APIMonitor(
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        PROXY_URL,
        CHECK_INTERVAL
    );

    await monitor.monitorApi(API_URL, mapUserWeibo);

    // Prevent Node.js from exiting
    process.on('SIGINT', () => {
        console.log('Gracefully shutting down');
        process.exit(0);
    });
}

// Start the application
main().catch((error) => {
    console.error("Application failed to start:", error);
    process.exit(1);
});