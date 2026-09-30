import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

/**
 * Private attachments came back as JSON describing a stream: the global
 * envelope wrapped the file itself, so the download had the document's
 * content type and none of its bytes.
 */
describe('the response envelope', () => {
  const context: any = {
    switchToHttp: () => ({ getRequest: () => ({ url: '/attachments/a1/download' }) }),
  };
  const run = (value: unknown) =>
    lastValueFrom(new ResponseInterceptor().intercept(context, { handle: () => of(value) }));

  it('wraps an ordinary answer', async () => {
    await expect(run({ id: 1 })).resolves.toMatchObject({ status: 'success', data: { id: 1 } });
  });

  it('leaves a file alone, so its bytes reach the browser', async () => {
    const file = new StreamableFile(Readable.from([Buffer.from('%PDF-1.1')]));
    await expect(run(file)).resolves.toBe(file);
  });
});
