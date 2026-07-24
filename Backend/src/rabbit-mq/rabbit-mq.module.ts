import { DynamicModule, Module } from '@nestjs/common';
import { ClientProxy, ClientsModule, Transport } from '@nestjs/microservices';
/** Minimal stub so LogInterceptor can inject LOG_SERVICE when RabbitMQ is not configured. */
function createNoopLogClient(): ClientProxy {
  return {
    emit: () => undefined,
    send: () => {
      throw new Error('LOG_SERVICE (RabbitMQ) is not configured');
    },
    connect: () => Promise.resolve(),
    close: () => Promise.resolve(),
  } as unknown as ClientProxy;
}

@Module({})
export class RabbitMqModule {
  static forRoot(): DynamicModule {
    const rabbitMqEnabled = process.env.RABBIT_MQ_ENABLED === 'true';
    // Build connection string with credentials if provided
    let rabbitMqUrl = process.env.RABBIT_MQ;
    const rabbitMqUser = process.env.RABBIT_MQ_USER || 'admin';
    const rabbitMqPass = process.env.RABBIT_MQ_PASS || 'admin';

    // If RABBIT_MQ is not set, still register LOG_SERVICE so LogInterceptor can start.
    // Without this, Nest throws: UnknownDependenciesException for LOG_SERVICE in AppModule.
    if (!rabbitMqEnabled || !rabbitMqUrl) {
      return {
        module: RabbitMqModule,
        imports: [],
        exports: ['LOG_SERVICE'],
        providers: [
          {
            provide: 'LOG_SERVICE',
            useValue: createNoopLogClient(),
          },
        ],
      };
    }
    
    // If RABBIT_MQ doesn't already contain @ (credentials), add them
    if (!rabbitMqUrl.includes('@')) {
      rabbitMqUrl = `${rabbitMqUser}:${rabbitMqPass}@${rabbitMqUrl}`;
    }
    
    const connectionUrl = `amqp://${rabbitMqUrl}`;
    console.log(`🔌 RabbitMQ connection URL: amqp://${rabbitMqUser}:***@${process.env.RABBIT_MQ}`);
    
    return {
      module: RabbitMqModule,
      imports: [
        ClientsModule.register([
          {
            name: 'LOG_SERVICE',
            transport: Transport.RMQ,
            options: {
              urls: [connectionUrl],
              queue: 'append_only_log',
              queueOptions: { durable: true },
            },
          },
        ]),
      ],
      exports: [ClientsModule],
      providers: [],
    };
  }
}
