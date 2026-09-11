import { describe, it, expect, mock, spyOn, afterEach, beforeEach } from 'bun:test';
import { ImageService } from './imageService.js';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  type Attachment,
} from 'botbuilder';

const TEAMS_SERVICE_URL = 'https://smba.trafficmanager.net/amer/';
const FILE_DOWNLOAD_INFO = 'application/vnd.microsoft.teams.file.download.info';

/**
 * Build a real TurnContext on a real CloudAdapter, with the per-turn ConnectorClient in turn state
 * exactly where CloudAdapterBase.processActivity() puts it. Only the MSAL token fetch is stubbed.
 */
async function createTurnContext(
  attachments: Attachment[],
  options: { channelId?: string; withConnectorClient?: boolean } = {}
): Promise<TurnContext> {
  const { channelId = 'msteams', withConnectorClient = true } = options;
  const auth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: 'test-app-id',
    MicrosoftAppPassword: 'test-secret',
    MicrosoftAppType: 'MultiTenant',
  });
  const adapter = new CloudAdapter(auth);
  const context = new TurnContext(adapter, {
    type: 'message',
    channelId,
    serviceUrl: TEAMS_SERVICE_URL,
    attachments,
  });

  if (withConnectorClient) {
    const claimsIdentity = {
      getClaimValue: (type: string) => (type === 'aud' ? 'test-app-id' : null),
    } as unknown as Parameters<typeof auth.createConnectorFactory>[0];
    const connectorClient = await auth
      .createConnectorFactory(claimsIdentity)
      .create(TEAMS_SERVICE_URL, 'https://api.botframework.com');
    spyOn(
      connectorClient.credentials as unknown as { getToken(): Promise<string> },
      'getToken'
    ).mockResolvedValue('bot-connector-token');
    context.turnState.set(adapter.ConnectorClientKey, connectorClient);
  }

  return context;
}

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

    it('finds a Teams file upload whose fileType is an image', () => {
      const attachments: Attachment[] = [
        { contentType: 'text/html', content: '<div></div>' },
        {
          contentType: FILE_DOWNLOAD_INFO,
          name: 'puzzle.PNG',
          content: { downloadUrl: 'https://contoso.sharepoint.com/dl', fileType: 'png' },
        },
      ];
      const context = { activity: { attachments } } as unknown as TurnContext;

      expect(service.getFirstImageAttachment(context)?.name).toBe('puzzle.PNG');
    });

    it('ignores a Teams file upload that is not an image', () => {
      const attachment: Attachment = {
        contentType: FILE_DOWNLOAD_INFO,
        name: 'notes.pdf',
        content: { downloadUrl: 'https://contoso.sharepoint.com/dl', fileType: 'pdf' },
      };
      expect(service.isImageAttachment(attachment)).toBe(false);
    });
  });

  describe('downloadAttachment', () => {
    const originalFetch = globalThis.fetch;
    let requests: { url: string; authorization: string | null }[];

    beforeEach(() => {
      requests = [];
      globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({
          url: input.toString(),
          authorization: new Headers(init?.headers).get('authorization'),
        });
        return new Response(new Uint8Array([1, 2, 3]));
      }) as unknown as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('sends the bot connector token for a Teams inline image on smba.trafficmanager.net', async () => {
      const attachment: Attachment = {
        contentType: 'image/*',
        contentUrl: 'https://smba.trafficmanager.net/amer/v3/attachments/0-abc/views/original',
      };
      const context = await createTurnContext([attachment]);

      const buffer = await service.downloadAttachment(context, attachment);

      expect([...buffer]).toEqual([1, 2, 3]);
      expect(requests).toEqual([
        { url: attachment.contentUrl!, authorization: 'Bearer bot-connector-token' },
      ]);
    });

    it('sends the bot connector token for a Teams inline image on *.teams.microsoft.com', async () => {
      const attachment: Attachment = {
        contentType: 'image/png',
        contentUrl: 'https://us-prod.asyncgw.teams.microsoft.com/v1/objects/0-abc/views/imgo',
      };
      const context = await createTurnContext([attachment]);

      await service.downloadAttachment(context, attachment);

      expect(requests[0]?.authorization).toBe('Bearer bot-connector-token');
    });

    it('never sends the token to a host that merely contains "microsoft.com"', async () => {
      const attachment: Attachment = {
        contentType: 'image/png',
        contentUrl: 'https://microsoft.com.attacker.example/puzzle.png',
      };
      const context = await createTurnContext([attachment]);

      await service.downloadAttachment(context, attachment);

      expect(requests).toEqual([{ url: attachment.contentUrl!, authorization: null }]);
    });

    it('downloads a Teams file upload from its pre-authenticated downloadUrl', async () => {
      const attachment: Attachment = {
        contentType: FILE_DOWNLOAD_INFO,
        contentUrl: 'https://contoso.sharepoint.com/personal/u/Documents/puzzle.png',
        name: 'puzzle.png',
        content: { downloadUrl: 'https://contoso.sharepoint.com/dl?tempauth=xyz', fileType: 'png' },
      };
      const context = await createTurnContext([attachment]);

      await service.downloadAttachment(context, attachment);

      expect(requests).toEqual([
        { url: 'https://contoso.sharepoint.com/dl?tempauth=xyz', authorization: null },
      ]);
    });

    it('downloads other channels without authentication', async () => {
      const attachment: Attachment = {
        contentType: 'image/png',
        contentUrl: 'https://webchat.botframework.com/attachments/conv-1/0?t=signed',
      };
      const context = await createTurnContext([attachment], { channelId: 'webchat' });

      await service.downloadAttachment(context, attachment);

      expect(requests).toEqual([{ url: attachment.contentUrl!, authorization: null }]);
    });

    it('falls back to an unauthenticated download when no connector client is available', async () => {
      const attachment: Attachment = {
        contentType: 'image/png',
        contentUrl: 'https://smba.trafficmanager.net/amer/v3/attachments/0-abc/views/original',
      };
      const context = await createTurnContext([attachment], { withConnectorClient: false });

      await service.downloadAttachment(context, attachment);

      expect(requests).toEqual([{ url: attachment.contentUrl!, authorization: null }]);
    });

    it('throws when the download fails', async () => {
      globalThis.fetch = mock(
        async () => new Response('denied', { status: 401 })
      ) as unknown as typeof fetch;
      const attachment: Attachment = {
        contentType: 'image/png',
        contentUrl: 'https://smba.trafficmanager.net/amer/v3/attachments/0-abc/views/original',
      };
      const context = await createTurnContext([attachment]);

      await expect(service.downloadAttachment(context, attachment)).rejects.toThrow('401');
    });
  });
});
