import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

redis.on('ready', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis connection error:', err.message || err.code));

// BullMQ opens its own connections, so it takes the connection details instead of this client
const { hostname, port, username, password, protocol } = new URL(process.env.REDIS_URL);
export const redisConnection = {
    host: hostname,
    port: Number(port) || 6379,
    username: decodeURIComponent(username),
    password: decodeURIComponent(password),
    tls: protocol === 'rediss:' ? {} : undefined,
};

export default redis;
