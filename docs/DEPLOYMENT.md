# Deployment Guide

This document provides detailed instructions for deploying Sudojo Bot to various chat platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Platform-Specific Setup](#platform-specific-setup)
  - [Microsoft Teams](#microsoft-teams)
  - [Azure Web Chat](#azure-web-chat)
  - [Slack](#slack)
  - [Facebook Messenger](#facebook-messenger)
  - [Telegram](#telegram)
  - [Direct Line (Custom Apps)](#direct-line-custom-apps)
- [Production Deployment with Traefik](#production-deployment-with-traefik)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

1. **Azure Account** - For Bot Framework registration
2. **Docker** - For containerized deployment
3. **Domain with SSL** - Required for most chat platforms
4. **Solver API** - Running instance of sudojo_solver

### Required Tools

```bash
# Check Docker
docker --version  # v20.10+

# Check Docker Compose
docker compose version  # v2.0+

# For local development
bun --version  # v1.0+
```

---

## Docker Deployment

### Build the Image

```bash
# From the project root
docker build -t sudojo_bot:latest .

# Or with a specific tag
docker build -t sudojo_bot:v1.0.0 .
```

### Run Locally

```bash
# Create .env file from example
cp .env.example .env
# Edit .env with your credentials

# Run the container
docker run -d \
  --name sudojo_bot \
  -p 3978:3978 \
  --env-file .env \
  sudojo_bot:latest

# Check logs
docker logs -f sudojo_bot

# Test health endpoint
curl http://localhost:3978/health
```

### Push to Registry

```bash
# Tag for your registry
docker tag sudojo_bot:latest docker.io/yourusername/sudojo_bot:latest

# Push
docker push docker.io/yourusername/sudojo_bot:latest
```

---

## Platform-Specific Setup

### Microsoft Teams

Microsoft Teams is the primary deployment target and offers the richest experience.

#### Step 1: Create Azure Bot Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new resource → Search "Azure Bot"
3. Fill in details:
   - **Bot handle**: `sudojo-bot` (globally unique)
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new or use existing
   - **Pricing tier**: F0 (Free) for testing, S1 for production
   - **Microsoft App ID**: Create new
4. Click **Create**

#### Step 2: Configure Bot Settings

1. Go to your Bot resource → **Configuration**
2. Note the **Microsoft App ID**
3. Click **Manage** next to Microsoft App ID
4. Go to **Certificates & secrets** → **New client secret**
5. Copy the secret value immediately (shown only once)
6. Back in Bot Configuration, set **Messaging endpoint**:
   ```
   https://your-domain.com/api/messages
   ```

#### Step 3: Enable Teams Channel

1. In your Bot resource → **Channels**
2. Click **Microsoft Teams**
3. Accept terms of service
4. Click **Apply**

#### Step 4: Deploy the Bot

Update your `.env`:

```bash
MICROSOFT_APP_ID=your-app-id-from-azure
MICROSOFT_APP_PASSWORD=your-client-secret
MICROSOFT_APP_TYPE=SingleTenant
SOLVER_API_URL=https://solver.sudojo.com
PORT=3978
```

Deploy using the production deployment method below.

#### Step 5: Install in Teams

**For Development/Testing:**
1. In Azure Bot → Channels → Teams → Click "Open in Teams"
2. Add the bot to your personal chat or a team

**For Organization-Wide Deployment:**
1. Create a Teams App Package (manifest.json + icons)
2. Upload to Teams Admin Center
3. Approve for your organization

#### Teams App Manifest Example

Create `manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR-APP-ID-GUID",
  "packageName": "com.sudojo.bot",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://sudojo.com",
    "privacyUrl": "https://sudojo.com/privacy",
    "termsOfUseUrl": "https://sudojo.com/terms"
  },
  "name": {
    "short": "Sudojo Bot",
    "full": "Sudojo Sudoku Hint Bot"
  },
  "description": {
    "short": "Get hints for your Sudoku puzzles",
    "full": "Upload a photo of your Sudoku puzzle and get step-by-step hints to help you solve it."
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "accentColor": "#5C6BC0",
  "bots": [
    {
      "botId": "YOUR-MICROSOFT-APP-ID",
      "scopes": ["personal", "team", "groupchat"],
      "supportsFiles": true,
      "isNotificationOnly": false
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["your-domain.com"]
}
```

---

### Azure Web Chat

Web Chat allows embedding the bot in any website.

#### Step 1: Get Direct Line Secret

1. In Azure Bot → **Channels**
2. Click **Direct Line**
3. Click **Show** to reveal the secret key
4. Copy one of the secret keys

#### Step 2: Embed in Website

```html
<!DOCTYPE html>
<html>
<head>
  <title>Sudojo Bot</title>
  <script src="https://cdn.botframework.com/botframework-webchat/latest/webchat.js"></script>
  <style>
    #webchat {
      height: 600px;
      width: 400px;
    }
  </style>
</head>
<body>
  <div id="webchat" role="main"></div>
  <script>
    window.WebChat.renderWebChat({
      directLine: window.WebChat.createDirectLine({
        secret: 'YOUR_DIRECT_LINE_SECRET'
      }),
      userID: 'user-' + Math.random().toString(36).substr(2, 9),
      username: 'Web User',
      locale: 'en-US'
    }, document.getElementById('webchat'));
  </script>
</body>
</html>
```

#### Security Note

For production, use token exchange instead of embedding the secret:

```javascript
// Backend endpoint to exchange secret for token
const response = await fetch('https://directline.botframework.com/v3/directline/tokens/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${DIRECT_LINE_SECRET}`
  }
});
const { token } = await response.json();
// Use token instead of secret in frontend
```

---

### Slack

#### Step 1: Create Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name: `Sudojo Bot`, Workspace: Your workspace

#### Step 2: Configure Bot

1. **OAuth & Permissions** → Add scopes:
   - `chat:write`
   - `files:read`
   - `im:history`
   - `im:read`
   - `im:write`
2. **Install to Workspace** → Copy **Bot User OAuth Token**

#### Step 3: Enable in Azure Bot

1. Azure Bot → **Channels** → **Slack**
2. Enter:
   - Client ID (from Slack Basic Information)
   - Client Secret
   - Verification Token
3. Copy the **Redirect URL** to Slack OAuth settings
4. Click **Save**

#### Step 4: Event Subscriptions

1. In Slack App → **Event Subscriptions** → Enable
2. Request URL: `https://slack.botframework.com/api/Events/{BOT-HANDLE}`
3. Subscribe to bot events:
   - `message.im`
   - `file_shared`

---

### Facebook Messenger

#### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create App → Select **Business** type
3. Add **Messenger** product

#### Step 2: Create Facebook Page

1. Create a Facebook Page for your bot (if not existing)
2. In Messenger Settings → Generate **Page Access Token**

#### Step 3: Configure Azure Bot

1. Azure Bot → **Channels** → **Facebook Messenger**
2. Enter:
   - Facebook App ID
   - Facebook App Secret
   - Page Access Token
3. Copy the **Callback URL** and **Verify Token**

#### Step 4: Webhook Setup

1. In Facebook App → Messenger → Webhooks
2. Edit Callback URL subscription
3. Paste Callback URL and Verify Token from Azure
4. Subscribe to: `messages`, `messaging_postbacks`

#### Step 5: App Review

For public use, submit for Facebook App Review:
- `pages_messaging` permission required

---

### Telegram

#### Step 1: Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Follow prompts to name your bot
4. Copy the **API Token**

#### Step 2: Configure Azure Bot

1. Azure Bot → **Channels** → **Telegram**
2. Enter the API Token from BotFather
3. Click **Save**

#### Step 3: Test

Search for your bot on Telegram and start chatting.

#### Note on File Uploads

Telegram has a 20MB file size limit. Ensure puzzle images are optimized.

---

### Direct Line (Custom Apps)

Direct Line allows integration with any custom application.

#### Step 1: Enable Direct Line

1. Azure Bot → **Channels** → **Direct Line**
2. Configure site (e.g., "Production")
3. Copy secret key

#### Step 2: Use Direct Line SDK

```typescript
import { DirectLine } from 'botframework-directlinejs';

const directLine = new DirectLine({
  secret: 'YOUR_DIRECT_LINE_SECRET'
  // Or use token for client-side apps
});

// Send message
directLine.postActivity({
  from: { id: 'user1', name: 'User' },
  type: 'message',
  text: 'Hello'
}).subscribe(
  id => console.log('Posted activity, id:', id),
  error => console.error('Error posting activity', error)
);

// Receive messages
directLine.activity$
  .filter(activity => activity.type === 'message')
  .subscribe(message => console.log('Received:', message));
```

#### Direct Line App Service Extension

For high-scale deployments, use Direct Line App Service Extension:

1. Azure Bot → Configuration → Enable Direct Line App Service Extension
2. Point to your App Service
3. Reduces latency by 2-3x

---

## Production Deployment with Traefik

This deployment method is compatible with `sudobility_dockerized` scripts.

### Step 1: Setup Doppler (Secrets Management)

1. Create project in [Doppler](https://doppler.com)
2. Add secrets:
   ```
   PORT=3978
   MICROSOFT_APP_ID=your-app-id
   MICROSOFT_APP_PASSWORD=your-secret
   MICROSOFT_APP_TYPE=SingleTenant
   SOLVER_API_URL=https://solver.sudojo.com
   ```
3. Generate Service Token for production environment

### Step 2: Deploy Service

From the `sudobility_dockerized` directory on your server:

```bash
cd ~/shapeshyft/sudobility_dockerized
./add.sh
```

When prompted:
- **Service name**: `sudojo_bot`
- **Hostname**: `bot.sudojo.com` (your domain)
- **Docker image**: `docker.io/yourusername/sudojo_bot:latest`
- **Health endpoint**: Select "1" for `/health`
- **Doppler token**: Paste your service token

### Step 3: Verify Deployment

```bash
# Check status
./status.sh

# View logs
cd config-generated/services/sudojo_bot
docker compose logs -f

# Test endpoint
curl https://bot.sudojo.com/health
```

### Step 4: Update Azure Bot Messaging Endpoint

In Azure Portal → Bot → Configuration:
```
Messaging endpoint: https://bot.sudojo.com/api/messages
```

### Upgrading

```bash
cd ~/shapeshyft/sudobility_dockerized
./upgrade.sh
# Select sudojo_bot when prompted
```

### Directory Structure After Deployment

The `sudobility_dockerized` scripts manage all services centrally:

```
sudobility_dockerized/
├── add.sh
├── upgrade.sh
├── remove.sh
├── status.sh
├── versions.sh
├── setup-scripts/
│   ├── common.sh
│   ├── traefik.sh
│   └── doppler.sh
└── config-generated/
    ├── traefik/
    │   └── docker-compose.yml
    ├── services/
    │   └── sudojo_bot/
    │       ├── docker-compose.yml
    │       ├── .env
    │       └── .service.conf
    └── .doppler-tokens/
        └── sudojo_bot
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | `3978` | HTTP server port |
| `MICROSOFT_APP_ID` | Yes | - | Azure Bot app ID |
| `MICROSOFT_APP_PASSWORD` | Yes | - | Azure Bot client secret |
| `MICROSOFT_APP_TYPE` | No | `SingleTenant` | Auth type: `SingleTenant` or `UserAssignedMSI` |
| `SOLVER_API_URL` | Yes | - | URL of sudojo_solver API |
| `NODE_ENV` | No | `production` | Environment mode |

---

## Troubleshooting

### Bot Not Responding

1. **Check container status**:
   ```bash
   docker ps -a | grep sudojo_bot
   docker logs sudojo_bot
   ```

2. **Verify health endpoint**:
   ```bash
   curl -v https://your-domain.com/health
   ```

3. **Check Azure Bot Configuration**:
   - Messaging endpoint matches your deployment URL
   - App ID and Password are correct

### Teams: "Unable to reach app"

1. Verify SSL certificate is valid
2. Check messaging endpoint in Azure Bot Configuration
3. Ensure Traefik is routing correctly:
   ```bash
   docker logs traefik 2>&1 | grep sudojo
   ```

### Images Not Processing

1. **Check OCR logs**:
   ```bash
   docker logs sudojo_bot 2>&1 | grep -i ocr
   ```

2. **Verify solver connectivity**:
   ```bash
   docker exec sudojo_bot curl -v $SOLVER_API_URL/health
   ```

3. **Teams image download issues**:
   - Ensure `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD` are set
   - Check Teams channel is enabled in Azure Bot

### SSL Certificate Issues

1. **Check Traefik logs**:
   ```bash
   docker logs traefik 2>&1 | grep -i acme
   ```

2. **Verify DNS**:
   ```bash
   dig +short your-domain.com
   ```

3. **Force certificate renewal**:
   ```bash
   docker exec traefik rm /data/acme.json
   docker restart traefik
   ```

### High Memory Usage

The OCR engine loads a ~15MB model. If memory is constrained:

1. Add memory limits to docker-compose.yml:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```

2. Consider using a shared OCR service instead of per-container

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/sudojo_bot/issues)
- **Documentation**: [Sudojo Docs](https://docs.sudojo.com)
- **Bot Framework**: [Microsoft Docs](https://docs.microsoft.com/en-us/azure/bot-service/)
