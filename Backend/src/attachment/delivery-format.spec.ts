import { deliveryFormat } from './cloudinary.service';

/**
 * A migrated video stored as "…hg9dd4.mp4" answered 404 through the API: the
 * CDN took ".mp4" for the format and looked for "…hg9dd4".
 */
describe('the format in a signed delivery URL', () => {
  it('names it for a video or image whose id ends in an extension', () => {
    expect(deliveryFormat('listings/ad-attachments/clip-hg9dd4.mp4', 'video')).toEqual({ format: 'mp4' });
    expect(deliveryFormat('listings/ad-attachments/photo.JPG', 'image')).toEqual({ format: 'jpg' });
  });

  it('adds nothing for an id without one, which the CDN serves in its own format', () => {
    expect(deliveryFormat('listings/ad-attachments/oer3wooo8lzlkj7vi1vk', 'image')).toEqual({});
  });

  it('adds nothing for a raw file, whose id is addressed whole', () => {
    expect(deliveryFormat('listings/ad-attachments/report.html', 'raw')).toEqual({});
  });
});
