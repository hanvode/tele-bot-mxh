import axios from 'axios';
import sanitizeHtml from 'sanitize-html';
import { defaultAxios } from '../utils/http';
import { logger } from '../utils/logger';
import { IGetWeiboLongTextParams, IGetWeiboParams, IWeiboAPIResponse, IWeiboLongTextResponse, IWeiboPost } from './type';
import OpenAI from 'openai';

export const blackWords: string[] = process.env.BLACK_WORDS ? process.env.BLACK_WORDS.split(',') : [];
export const whiteWords: string[] = process.env.WHITE_WORDS ? process.env.WHITE_WORDS.split(',') : [];

export class APIMonitor {
    private openai: OpenAI;
    constructor(
        private translateProxy = '',
        private checkInterval = 3600,
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });
    }

    // get data weibo post today
    public async getDataWeiboPost(apiUrl: string, id: string): Promise<IWeiboPost[]> {
        const now = Date.now();
        const thresholdTime = now - (36000 * 1000);
        const newPosts: IWeiboPost[] = []
        let isContinuePost = true;
        let start = 1;
        while (isContinuePost) {
            let weiboPosts;
            try {
                weiboPosts = await this.getUserWeiboPosts(apiUrl, {
                    uid: id,
                    page: start,
                    feature: 0
                });
            } catch (error) {
                throw error;
            }

            if (!weiboPosts) {
                throw new Error("API trả về dữ liệu rỗng (null/undefined)");
            }
            console.log("DDDDDDDD", weiboPosts.list?.length);
            if (!weiboPosts?.list || weiboPosts?.list?.length === 0) break;
            for (const newData of weiboPosts.list) {
                const postTime = new Date(newData.created_at).getTime();
                // Nếu bài viết (không phải bài ghim) cũ hơn khoảng thời gian kiểm tra => dừng luôn
                if (postTime < thresholdTime) {
                    if (newData.isTop) continue;
                    isContinuePost = false;
                    break;
                }
                console.log("test");

                let longText = newData.text_raw;
                try {
                    if (newData.isLongText) {
                        const longTextData = await this.getDetailLongTextPost({
                            id: newData.mblogid,
                            refererUid: id
                        })
                        longText = longTextData.longTextContent;
                    }

                    if (newData.retweeted_status) {
                        if (newData.retweeted_status.isLongText) {
                            const retweetLongTextData = await this.getDetailLongTextPost({
                                id: newData.retweeted_status.mblogid,
                                refererUid: id
                            });
                            longText += `\n[Chia sẻ lại]:\n${retweetLongTextData.longTextContent}`;
                        } else
                            // Ngược lại thì thêm nguyên văn
                            longText += `\n[Chia sẻ lại]:\n${newData.retweeted_status.text_raw}`;
                    }
                } catch (error) {
                    throw error;
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
                    created_at: newData.created_at,
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

    public async getUserWeiboPosts(url: string, params: IGetWeiboParams): Promise<IWeiboAPIResponse> {
        try {
            const res = await defaultAxios.get(url, {
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                    'client-version': 'v2.47.83',
                    cookie: process.env.COOKIE_WEIBO || '',
                    referer: `https://weibo.com/u/${params.uid}`,
                    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'x-requested-with': 'XMLHttpRequest',
                    'x-xsrf-token': 'lNQFjuUpzY0uClYggP13l8Be',
                },
                params: {
                    uid: params.uid,
                    page: params.page,
                    feature: params.feature,
                },
                timeout: 60000,
            });

            return res.data?.data || {};
        } catch (error) {
            logger.error(`getUserWeiboPosts error: ${String(error)}`);
            throw error;
        }
    }

    private async translateViaProxy(text: string): Promise<string> {
        const maxRetries = 3;                     // thử lại tối đa 3 lần
        const baseDelay = 500;                    // 500ms → 1s → 2s (exponential)

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.post(this.translateProxy, {
                    q: text,
                    from: "zh-CN",
                    to: "vi"
                }, {
                    timeout: 5000,                // tránh treo request
                });

                return response.data.translatedText;
            } catch (err: any) {
                const errMsg = err?.message || String(err);
                console.error(`❌ Lỗi dịch qua proxy (attempt ${attempt}/${maxRetries}):`, errMsg, text);

                if (attempt < maxRetries) {
                    // exponential backoff delay
                    const wait = baseDelay * Math.pow(2, attempt - 1);
                    await new Promise(res => setTimeout(res, wait));
                } else {
                    // hết retry → fallback
                    console.error("⚠️ Hết lượt retry, trả về text gốc:", text);
                    return text;
                }
            }
        }

        return text; // fallback an toàn (không chạy tới đây)
    }

    public async translateMultiline1(text: string): Promise<string> {
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

    /**
 * Dịch nhiều đoạn văn bản cùng lúc bằng OpenAI GPT-4o mini.
 * Gộp tất cả đoạn vào 1 request duy nhất để tiết kiệm chi phí.
 * Mỗi đoạn phân cách bằng "|||" để tách kết quả sau khi dịch.
 */
    public async translateMultiline(text: string): Promise<string> {
        if (!text) return '';

        const SEPARATOR = '|||';
        const maxRetries = 3;
        const baseDelay = 500;

        // Tách thành từng dòng, bỏ dòng trắng
        const segments = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

        if (segments.length === 0) return '';

        // Gộp tất cả dòng thành 1 prompt duy nhất
        const combinedText = segments.join(`\n${SEPARATOR}\n`);

        const systemPrompt =
            `You are a professional Chinese to Vietnamese translator. ` +
            `Translate the following text. Each segment is separated by "${SEPARATOR}". ` +
            `Keep the same separator between translated segments. ` +
            `Preserve hashtags (e.g. #tag#), usernames (@xxx), and emojis as-is. ` +
            `Output only the translation, nothing else.`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    temperature: 0.1,   // Độ sáng tạo thấp → dịch nhất quán hơn
                    max_tokens: 4096,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: combinedText },
                    ],
                });

                const translated = response.choices[0]?.message?.content?.trim() || '';
                const translatedSegments = translated.split(SEPARATOR).map(s => s.trim());

                // Nếu số đoạn khớp → dùng luôn
                if (translatedSegments.length === segments.length) {
                    return translatedSegments.join('\n');
                }

                // Nếu không khớp số đoạn → log warning nhưng vẫn dùng kết quả
                logger.warn(
                    `⚠️ Số đoạn dịch không khớp: expected ${segments.length}, got ${translatedSegments.length}. Dùng kết quả nguyên.`
                );
                return translated;

            } catch (err: any) {
                const errMsg = err?.message || String(err);
                logger.error(`❌ OpenAI translate error (attempt ${attempt}/${maxRetries}): ${errMsg}`);

                if (attempt < maxRetries) {
                    const wait = baseDelay * Math.pow(2, attempt - 1);
                    await new Promise(res => setTimeout(res, wait));
                } else {
                    logger.error('⚠️ Hết lượt retry, trả về text gốc.');
                    return text; // fallback về text gốc
                }
            }
        }

        return text;
    }


    public splitMessage(message: string, maxLength = 3000): string[] {
        let parts = [];
        for (let i = 0; i < message.length; i += maxLength) {
            parts.push(message.slice(i, i + maxLength));
        }
        return parts;
    }

    public sanitizeForTelegram(message: string): string {
        if (!message) return '';

        // Loại bỏ toàn bộ HTML tag
        let clean = sanitizeHtml(message, {
            allowedTags: [], // Không cho phép tag nào cả
            allowedAttributes: {}, // Không cho phép attribute nào
        });

        // Telegram có thể lỗi nếu còn các ký tự đặc biệt chưa encode
        clean = clean
            .replace(/&nbsp;/g, ' ') // thay &nbsp; bằng space
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/<[^>]*>/g, '') // đảm bảo remove tag còn sót
            .replace(/\*/g, '\\*') // tránh lỗi markdown khi send parse_mode=Markdown
            .replace(/_/g, '\\_')
            .replace(/`/g, '\\`')
            .replace(/\[/g, '\\[');

        return clean.trim();
    }

    private getDateString(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    public async handleBuildMessage(newData: IWeiboPost[], weiboName: string): Promise<string> {
        let messageString: string = '';
        if (newData.length > 0) {
            const now = new Date();
            const currentDate = this.getDateString(now);
            messageString += `🌐 Người dùng: ${weiboName} có ${newData.length} tin mới ngày ${currentDate}\n\n`
            let stt = 1;
            for (let i = newData.length - 1; i >= 0; i--) {
                const post = newData[i];
                const noiDung = await this.translateMultiline(post.text_raw || '');
                console.log('Noi dung====>', noiDung);
                messageString += `${stt}. ⏰ Thời gian: ${post.created_at} (giờ Trung Quốc)\n` +
                    `📝 Nội dung bài:\n${noiDung}\n\n`;
                stt++;
            }
        }
        return messageString;
    }

    public async getDetailLongTextPost(
        params: IGetWeiboLongTextParams
    ): Promise<IWeiboLongTextResponse> {
        const url = 'https://weibo.com/ajax/statuses/longtext';

        try {
            const res = await defaultAxios.get(url, {
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                    'client-version': 'v2.47.83',
                    cookie: process.env.COOKIE_WEIBO || '',
                    referer: `https://weibo.com/u/${params.refererUid}`,
                    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent':
                        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                    'x-requested-with': 'XMLHttpRequest',
                    'x-xsrf-token': 'lNQFjuUpzY0uClYggP13l8Be',
                },
                params: {
                    id: params.id,
                },
                timeout: 30000,
            });

            return res.data?.data || { longTextContent: '' };
        } catch (error) {
            logger.error(`getDetailLongTextPost error: ${String(error)}`);
            throw error;
        }
    }
}