import { NotificationService } from './notification.service';

describe('NotificationService.notify', () => {
  it('writes the notification and clears the cached list and count, so it shows at once', async () => {
    const db = { notification: { create: jest.fn().mockResolvedValue({ id: 'n1' }) } };
    const cache = { del: jest.fn().mockResolvedValue(undefined) };
    const service = new NotificationService(db as any, cache as any);

    await service.notify('owner-1', {
      title: 'Your listing was blocked',
      message: 'Reason: Spam.',
      type: 'warning',
      link: '/my-listings',
    });

    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'owner-1',
        title: 'Your listing was blocked',
        message: 'Reason: Spam.',
        type: 'warning',
        link: '/my-listings',
      },
    });
    expect(cache.del).toHaveBeenCalledWith('notification:list:owner-1');
    expect(cache.del).toHaveBeenCalledWith('notification:unread:owner-1');
  });
});
