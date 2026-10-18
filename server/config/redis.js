import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

redis.on('ready', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis connection error:', err.message || err.code));

export default redis;
