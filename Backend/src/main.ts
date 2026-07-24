import { config as loadEnv } from 'dotenv';
loadEnv();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from 'common/interceptor/http-exception.interceptor';
import { ResponseInterceptor } from 'common/interceptor/response.interceptor';
import { AuthGuard } from 'common/guard/auth.guard';
import { RolesGuard } from 'common/guard/role.guard';
import { RedisAdapterService } from './redis-adapter/redis-adapter.service';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { LogInterceptor } from 'common/interceptor/log.interceptor';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { perfStore } from './perf/perf.store';
import { performance } from 'perf_hooks';

async function bootstrap() {
  const bootstrapStart = performance.now();
  perfStore.timings.bootstrapStartMs = Date.now();
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'mongodb://localhost:27017/ex-buy-sell-db';
    console.warn('⚠️  DATABASE_URL not set. Using default local MongoDB.');
  }

  const app = await NestFactory.create(AppModule);
  perfStore.timings.nestCreateMs = performance.now() - bootstrapStart;
  app.enableCors({
    origin: '*',
  });
  app.useGlobalGuards(app.get(AuthGuard), app.get(RolesGuard));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    app.get(ResponseInterceptor),
    app.get(LogInterceptor),
  );
  
  const config = new DocumentBuilder()
    .setTitle('ExBuySell - Api Documentation')
    .setDescription('')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
  jsonDocumentUrl: 'swagger/json',
  
});

// config: RabbitMQ Microservices (Optional - only start when explicitly enabled)
const rabbitMqEnabled = process.env.RABBIT_MQ_ENABLED === 'true';
if (rabbitMqEnabled && process.env.RABBIT_MQ) {
  try {
    // Build connection string with credentials if provided
    let rabbitMqUrl = process.env.RABBIT_MQ;
    const rabbitMqUser = process.env.RABBIT_MQ_USER || 'admin';
    const rabbitMqPass = process.env.RABBIT_MQ_PASS || 'admin';
    
    // If RABBIT_MQ doesn't already contain @ (credentials), add them
    if (!rabbitMqUrl.includes('@')) {
      rabbitMqUrl = `${rabbitMqUser}:${rabbitMqPass}@${rabbitMqUrl}`;
    }
    
    const connectionUrl = `amqp://${rabbitMqUrl}`;
    console.log(`🔌 Connecting to RabbitMQ: amqp://${rabbitMqUser}:***@${process.env.RABBIT_MQ}`);
    
    const rabbitStart = performance.now();
    const logQueue = await NestFactory.createMicroservice<MicroserviceOptions>(
      ActivityLogModule,
      {
        transport: Transport.RMQ,
        options: {
          urls: [connectionUrl],
          queue: 'append_only_log',
          queueOptions: {
            durable: true,
          },
        },
      },
    );
    await logQueue.listen();
    perfStore.timings.rabbitMqConnectMs = performance.now() - rabbitStart;
    console.log('✅ RabbitMQ microservice connected successfully');
  } catch (error) {
    console.warn('⚠️  RabbitMQ connection failed. Activity logging will be disabled.');
    console.warn('   To enable: Start RabbitMQ server or set RABBIT_MQ environment variable');
    console.warn('   Error:', error instanceof Error ? error.message : error);
  }
} else {
  console.log('ℹ️  RabbitMQ microservice disabled. Activity logging microservice skipped.');
  console.log('   To enable: Set RABBIT_MQ_ENABLED=true and configure RABBIT_MQ (e.g., localhost:5672)');
}

  // config: Redis (measured inside RedisAdapterService)
  // const redisIoAdapter = app.get(RedisAdapterService);
  // await redisIoAdapter.connectToRedis();
  // app.useWebSocketAdapter(redisIoAdapter);

  // Capture time to first HTTP response after listen
  app.use((req, res, next) => {
    if (!perfStore.firstResponseRecorded) {
      res.once('finish', () => {
        if (!perfStore.firstResponseRecorded) {
          perfStore.timings.firstHttpResponseMs = performance.now() - bootstrapStart;
          perfStore.firstResponseRecorded = true;
        }
      });
    }
    next();
  });

  const port = process.env.PORT ?? 5000;
  const listenStart = performance.now();
  const server = await app.listen(port);
  // Avoid premature socket closes behind reverse proxies (helps large JSON responses).
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  perfStore.timings.appListenMs = performance.now() - listenStart;
  perfStore.timings.totalBootstrapMs = performance.now() - bootstrapStart;
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📡 WebSocket Gateway is available at: ws://localhost:${port}`);
}
bootstrap();
