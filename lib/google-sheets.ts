import { google } from 'googleapis';

// ✅ 正確的語法
export async function getGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: { // <-- 這裡加上冒號
      client_email: process.env.GOOGLE_CLIENT_EMAIL, // <-- 這裡加上冒號
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // <-- 這裡加上冒號
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client as any });
  return sheets;
}