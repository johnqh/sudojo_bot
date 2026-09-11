/**
 * Image Service for downloading attachments from various channels
 * Handles authentication for different platforms (Teams, Slack, etc.)
 */

import type { TurnContext, Attachment } from 'botbuilder';

/** Teams file upload (bot manifest `supportsFiles: true`), e.g. a photo sent in a personal chat. */
const TEAMS_FILE_DOWNLOAD_INFO = 'application/vnd.microsoft.teams.file.download.info';

const IMAGE_FILE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);

/**
 * Microsoft-owned hosts that serve Teams inline-image bytes and require the bot's connector
 * token. Matched against the parsed hostname, never a substring of the URL, so the token cannot
 * leak to look-alike hosts. (`*.trafficmanager.net` is open to any Azure tenant, so only the
 * exact `smba` host is trusted.)
 */
const CONNECTOR_TOKEN_HOSTS = ['smba.trafficmanager.net'];
const CONNECTOR_TOKEN_HOST_SUFFIXES = ['.teams.microsoft.com', '.asm.skype.com'];

/** `content` of a Teams file-download-info attachment. */
interface TeamsFileDownloadInfo {
  downloadUrl?: string;
  fileType?: string;
}

/**
 * The slice of botframework-connector's ConnectorClient we use. CloudAdapter stores the per-turn
 * client in `turnState` under `adapter.ConnectorClientKey`; its `credentials` are the bot's
 * AppCredentials (password, certificate, managed identity, ...) for the activity's serviceUrl.
 */
interface ConnectorClientLike {
  credentials?: {
    signRequest(request: { headers: { set(name: string, value: string): void } }): Promise<unknown>;
  };
}

/**
 * Service for downloading image attachments from Bot Framework messages.
 * Handles platform-specific authentication for Teams, Slack, and other channels.
 */
export class ImageService {
  /**
   * Download an image attachment from a message
   * Handles platform-specific authentication
   */
  async downloadAttachment(context: TurnContext, attachment: Attachment): Promise<Buffer> {
    // Teams file uploads: contentUrl is the SharePoint/OneDrive item (needs Graph auth), but
    // content.downloadUrl is a short-lived pre-authenticated link.
    if (this.isTeamsFileDownloadInfo(attachment)) {
      const downloadUrl = this.getFileDownloadInfo(attachment)?.downloadUrl;
      if (!downloadUrl) {
        throw new Error('Teams file attachment has no download URL');
      }
      return this.fetchBuffer(downloadUrl);
    }

    const url = attachment.contentUrl;

    if (!url) {
      throw new Error('Attachment has no content URL');
    }

    const authorization = this.requiresConnectorToken(context, url)
      ? await this.getConnectorAuthorization(context)
      : undefined;

    return this.fetchBuffer(url, authorization);
  }

  /**
   * Whether a Teams attachment URL is served by the channel itself (the activity's serviceUrl
   * origin, which already receives the bot token for every reply) or a known Teams host.
   * Other channels (Web Chat, Direct Line, ...) hand out URLs that need no bot token.
   */
  private requiresConnectorToken(context: TurnContext, url: string): boolean {
    if (context.activity.channelId !== 'msteams') {
      return false;
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return false;
    }

    const serviceUrl = context.activity.serviceUrl;
    if (serviceUrl && URL.canParse(serviceUrl) && new URL(serviceUrl).origin === target.origin) {
      return true;
    }

    if (target.protocol !== 'https:') {
      return false;
    }
    const host = target.hostname.toLowerCase();
    return (
      CONNECTOR_TOKEN_HOSTS.includes(host) ||
      CONNECTOR_TOKEN_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
    );
  }

  /**
   * Get the `Authorization` header value for the bot's connector token.
   * Returns undefined when there is no connector client or the bot has no app ID (Emulator).
   */
  private async getConnectorAuthorization(context: TurnContext): Promise<string | undefined> {
    const connectorClient: ConnectorClientLike | undefined = context.turnState.get(
      context.adapter.ConnectorClientKey
    );
    const credentials = connectorClient?.credentials;
    if (!credentials) {
      return undefined;
    }

    // signRequest() is the credential-type-agnostic API: AppCredentials sets
    // "Bearer <token>" (fetched and cached via MSAL), or leaves the request unsigned when
    // authentication is disabled. It only touches `headers`, so a minimal request suffices.
    let authorization: string | undefined;
    await credentials.signRequest({
      headers: {
        set: (name, value) => {
          if (name.toLowerCase() === 'authorization') {
            authorization = value;
          }
        },
      },
    });
    return authorization;
  }

  /**
   * Download a URL into a Buffer, optionally with an Authorization header
   */
  private async fetchBuffer(url: string, authorization?: string): Promise<Buffer> {
    const response = await fetch(
      url,
      authorization ? { headers: { Authorization: authorization } } : undefined
    );

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private isTeamsFileDownloadInfo(attachment: Attachment): boolean {
    return attachment.contentType?.toLowerCase() === TEAMS_FILE_DOWNLOAD_INFO;
  }

  private getFileDownloadInfo(attachment: Attachment): TeamsFileDownloadInfo | undefined {
    const content: unknown = attachment.content;
    return content && typeof content === 'object' ? (content as TeamsFileDownloadInfo) : undefined;
  }

  /**
   * Check if an attachment is an image
   */
  isImageAttachment(attachment: Attachment): boolean {
    const contentType = attachment.contentType?.toLowerCase() || '';

    if (contentType === TEAMS_FILE_DOWNLOAD_INFO) {
      const fileType =
        this.getFileDownloadInfo(attachment)?.fileType ?? attachment.name?.split('.').pop();
      return IMAGE_FILE_TYPES.has(fileType?.toLowerCase() ?? '');
    }

    return (
      contentType.startsWith('image/') || contentType === 'application/octet-stream' // Sometimes images come as this
    );
  }

  /**
   * Get the first image attachment from a message
   */
  getFirstImageAttachment(context: TurnContext): Attachment | undefined {
    const attachments = context.activity.attachments || [];
    return attachments.find(a => this.isImageAttachment(a));
  }
}
