import { logger } from './utils/logger';
import { monitorQueue } from './queues/monitotQueue';

const weiboEnv = process.env.WEIBO_ACCOUNTS || '';
const weiboAcoounts = weiboEnv.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
    const [id, name] = pair.split(':').map(x => x.trim());
    return { id, name: name };
});


async function scheduleOnce() {
    const apiUrl = process.env.API_URL || '';
    for (let i = 0; i < weiboAcoounts.length; i++) {
        const delayTime = i * 20 * 1000; // Delay mỗi job thêm 30 giây
        const weibo = weiboAcoounts[i];
        await monitorQueue.add('checkApiWeibo', { apiUrl, idWeibo: weibo.id, weiboName: weibo.name }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
            removeOnComplete: true,
            removeOnFail: false,
            delay: delayTime,
        });
        logger.info(`Enqueued job for account ${weibo.name} with id: ${weibo.id}`);
    }
}

const intervalSec = Number(process.env.CHECK_INTERVAL || 3600);
setInterval(() => {
    scheduleOnce();
}, intervalSec * 1000);