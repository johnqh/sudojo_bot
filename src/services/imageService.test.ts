import { describe, it, expect } from 'bun:test';
import { ImageService } from './imageService.js';
import type { Attachment, TurnContext } from 'botbuilder';

describe('ImageService', () => {
  const service = new ImageService();

  describe('isImageAttachment', () => {
    it('accepts image/png content type', () => {
      const attachment: Attachment = { contentType: 'image/png' };
      expect(service.isImageAttachment(attachment)).toBe(true);
    });

    it('accepts image/jpeg content type', () => {
      const attachment: Attachment = { contentType: 'image/jpeg' };
      expect(service.isImageAttachment(attachment)).toBe(true);
    });

    it('accepts image/gif content type', () => {
      const attachment: Attachment = { contentType: 'image/gif' };
      expect(service.isImageAttachment(attachment)).toBe(true);
    });

    it('accepts application/octet-stream (binary images)', () => {
      const attachment: Attachment = { contentType: 'application/octet-stream' };
      expect(service.isImageAttachment(attachment)).toBe(true);
    });

    it('accepts uppercase content type', () => {
      const attachment: Attachment = { contentType: 'IMAGE/PNG' };
      expect(service.isImageAttachment(attachment)).toBe(true);
    });

    it('rejects application/pdf', () => {
      const attachment: Attachment = { contentType: 'application/pdf' };
      expect(service.isImageAttachment(attachment)).toBe(false);
    });

    it('rejects text/plain', () => {
      const attachment: Attachment = { contentType: 'text/plain' };
      expect(service.isImageAttachment(attachment)).toBe(false);
    });

    it('handles missing contentType', () => {
      const attachment: Attachment = { contentType: '' };
      expect(service.isImageAttachment(attachment)).toBe(false);
    });
  });

  describe('getFirstImageAttachment', () => {
    it('finds first image in array of attachments', () => {
      const attachments: Attachment[] = [
        { contentType: 'text/plain', name: 'notes.txt' },
        { contentType: 'image/png', name: 'puzzle.png' },
        { contentType: 'image/jpeg', name: 'photo.jpg' },
      ];
      const context = {
        activity: { attachments },
      } as unknown as TurnContext;

      const result = service.getFirstImageAttachment(context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('puzzle.png');
    });

    it('returns undefined when no images present', () => {
      const attachments: Attachment[] = [
        { contentType: 'text/plain', name: 'notes.txt' },
        { contentType: 'application/pdf', name: 'document.pdf' },
      ];
      const context = {
        activity: { attachments },
      } as unknown as TurnContext;

      const result = service.getFirstImageAttachment(context);
      expect(result).toBeUndefined();
    });

    it('handles empty attachments array', () => {
      const context = {
        activity: { attachments: [] },
      } as unknown as TurnContext;

      const result = service.getFirstImageAttachment(context);
      expect(result).toBeUndefined();
    });

    it('handles undefined attachments', () => {
      const context = {
        activity: {},
      } as unknown as TurnContext;

      const result = service.getFirstImageAttachment(context);
      expect(result).toBeUndefined();
    });
  });
});
