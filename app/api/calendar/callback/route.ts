import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://tomos-task-api.vercel.app/api/calendar/callback';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not provided' },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Return tokens to user
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TomOS Calendar - Authorization Success</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 100px auto;
              padding: 20px;
              text-align: center;
            }
            .success {
              background: #10B981;
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .token-box {
              background: #F3F4F6;
              border: 1px solid #D1D5DB;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: left;
              font-family: monospace;
              font-size: 12px;
              overflow-wrap: break-word;
              max-height: 200px;
              overflow-y: auto;
            }
            .label {
              font-weight: bold;
              color: #374151;
              margin-top: 15px;
              margin-bottom: 5px;
            }
            .instructions {
              background: #EFF6FF;
              border-left: 4px solid #3B82F6;
              padding: 15px;
              margin: 30px 0;
              text-align: left;
            }
            button {
              background: #6366F1;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              margin: 5px;
            }
            button:hover {
              background: #4F46E5;
            }
            .copy-success {
              color: #10B981;
              font-size: 12px;
              margin-top: 10px;
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ Authorization Successful!</h1>
            <p>TomOS can now sync your tasks with Google Calendar</p>
          </div>

          <div class="instructions">
            <h3>📋 Next Steps:</h3>
            <ol>
              <li>Copy your <strong>Refresh Token</strong> below</li>
              <li>Save it somewhere safe (you'll need it for syncing)</li>
              <li>Close this window</li>
            </ol>
          </div>

          <div class="label">🔑 Refresh Token (SAVE THIS!):</div>
          <div class="token-box" id="refresh-token">${tokens.refresh_token || 'Not provided - try authorizing again with access_type=offline'}</div>
          <button onclick="copyToken('refresh-token')">Copy Refresh Token</button>
          <div class="copy-success" id="refresh-copy">✅ Copied to clipboard!</div>

          <div class="label">Access Token (temporary, for testing):</div>
          <div class="token-box" id="access-token">${tokens.access_token}</div>
          <button onclick="copyToken('access-token')">Copy Access Token</button>
          <div class="copy-success" id="access-copy">✅ Copied to clipboard!</div>

          <div class="instructions" style="margin-top: 40px;">
            <h3>🚀 How to Use:</h3>
            <p>Use the refresh token to sync tasks:</p>
            <pre style="background: white; padding: 15px; border-radius: 4px; overflow-x: auto;">
curl -X POST https://tomos-task-api.vercel.app/api/calendar/sync \\
  -H "Content-Type: application/json" \\
  -d '{"action":"sync","refreshToken":"YOUR_REFRESH_TOKEN"}'
            </pre>
            <p style="margin-top: 15px;">Or set it as an environment variable in Vercel:</p>
            <pre style="background: white; padding: 15px; border-radius: 4px;">
GOOGLE_CALENDAR_REFRESH_TOKEN=your_refresh_token_here
            </pre>
          </div>

          <script>
            function copyToken(elementId) {
              const element = document.getElementById(elementId);
              const text = element.textContent;
              navigator.clipboard.writeText(text).then(() => {
                const successId = elementId.replace('-token', '-copy');
                const successElement = document.getElementById(successId);
                successElement.style.display = 'block';
                setTimeout(() => {
                  successElement.style.display = 'none';
                }, 2000);
              });
            }
          </script>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange authorization code' },
      { status: 500 }
    );
  }
}
