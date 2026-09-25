import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListingService } from 'src/listing/listing.service';
import { SmsModule } from 'src/sms/sms.module';
import { MailModule } from 'src/mail/mail.module';

/**
 * The auth module now reaches into the listing module, to turn a guest's
 * waiting listing into a draft when their sign-up is confirmed. This checks
 * the wiring holds — Nest can build the auth service with a listing service in
 * it — without a database behind it.
 */
describe('AuthModule wiring', () => {
  it('builds the auth service with the listing service it needs', async () => {
    // The two global modules the app provides to everyone.
    const moduleRef = await Test.createTestingModule({ imports: [SmsModule, MailModule, AuthModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn(), onModuleInit: jest.fn() })
      .compile();
    const auth = moduleRef.get(AuthService);
    expect(auth).toBeDefined();
    expect((auth as any).listings).toBeInstanceOf(ListingService);
  }, 60000);
});
