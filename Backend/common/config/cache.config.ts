import { createKeyv } from '@keyv/redis';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

export class CacheConfig implements CacheOptionsFactory {
  createCacheOptions(): CacheModuleOptions {
    return {
      stores: [
        new Keyv({
          store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
        }),
        createKeyv('redis://localhost:6379'),
      ],
    };
  }
}

export const CACHE_TTL = 10000;
