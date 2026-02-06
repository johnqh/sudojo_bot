/**
 * Image Service for downloading attachments from various channels
 * Handles authentication for different platforms (Teams, Slack, etc.)
 */

import type { TurnContext, Attachment } from 'botbuilder';

export class ImageService {
  /**
   * Download an image attachment from a message
   * Handles platform-specific authentication
   */
  async downloadAttachment(context: TurnContext, attachment: Attachment): Promise<Buffer> {
    const url = attachment.contentUrl;

    if (!url) {
      throw new Error('Attachment has no content URL');
    }

    // Check if this is a Teams attachment that needs connector client
    if (this.isTeamsAttachment(context, url)) {
      return this.downloadTeamsAttachment(context, url);
    }

    // For other channels, try direct download
    return this.downloadDirectly(url);
  }

  /**
   * Check if attachment requires Teams connector client
   */
  private isTeamsAttachment(context: TurnContext, url: string): boolean {
    const channelId = context.activity.channelId;
    return channelId === 'msteams' && url.includes('microsoft.com');
  }

  /**
   * Download attachment using Teams connector client
   */
  private async downloadTeamsAttachment(context: TurnContext, url: string): Promise<Buffer> {
    const connectorClient = context.turnState.get(context.adapter.ConnectorClientKey);

    if (!connectorClient) {
      // Fall back to direct download with auth token
      const token = await this.getTeamsToken(context);
      return this.downloadWithAuth(url, token);
    }

    // Use connector client to download
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await this.getTeamsToken(context)}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download Teams attachment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get Teams authentication token
   */
  private async getTeamsToken(context: TurnContext): Promise<string> {
    // The adapter should have the token in the turn state
    const token = context.turnState.get('BotAccessToken');
    if (token) {
      return token;
    }

    // If no token available, throw
    throw new Error('No Teams authentication token available');
  }

  /**
   * Download with authorization header
   */
  private async downloadWithAuth(url: string, token: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Download attachment directly (no auth)
   */
  private async downloadDirectly(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Check if an attachment is an image
   */
  isImageAttachment(attachment: Attachment): boolean {
    const contentType = attachment.contentType?.toLowerCase() || '';
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
