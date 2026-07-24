import { Injectable } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Redis } from 'ioredis';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { perfStore } from '../perf/perf.store';
import { performance } from 'perf_hooks';

@Injectable()
export class RedisAdapterService extends IoAdapter {
  private pubClient: Redis;
  private subClient: Redis;

  async connectToRedis(): Promise<void> {
    const start = performance.now();
    const redisUrl = (() => {
      const fromUrl = process.env.REDIS_URL?.trim();
      if (fromUrl) {
        return fromUrl.startsWith('redis://') ? fromUrl : `redis://${fromUrl}`;
      }
      const host = process.env.REDIS_HOST || 'localhost:6379';
      return host.startsWith('redis://') ? host : `redis://${host}`;
    })();
    
    console.log(`🔌 Connecting to Redis: ${redisUrl}`);
    
    this.pubClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`⏳ Redis reconnecting in ${delay}ms... (attempt ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    
    this.subClient = this.pubClient.duplicate();
    
    // Set up error handlers
    this.pubClient.on('error', (err) => {
      console.error('❌ Redis pub error:', err.message);
    });
    
    this.subClient.on('error', (err) => {
      console.error('❌ Redis sub error:', err.message);
    });
    
    // Set up connection event handlers
    this.pubClient.on('connect', () => {
      console.log('🔗 Redis pub client connecting...');
    });
    
    this.pubClient.on('ready', () => {
      console.log('✅ Redis pub client ready');
    });
    
    this.subClient.on('connect', () => {
      console.log('🔗 Redis sub client connecting...');
    });
    
    this.subClient.on('ready', () => {
      console.log('✅ Redis sub client ready');
    });
    
    // Wait for connection to be established
    try {
      await Promise.all([
        this.pubClient.ping(),
        this.subClient.ping()
      ]);
      perfStore.timings.redisConnectMs = performance.now() - start;
      console.log('✅ Redis adapter connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // createIOServer(port: number, options?: ServerOptions) {
  //   const server = super.createIOServer(port, options);
  //   server.adapter(createAdapter(this.pubClient, this.subClient));
  //   return server;
  // }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  onMessage(channel: string, message: any) {
    console.log(`Received message on channel ${channel}:`, message);
  }
}
