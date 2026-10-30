import { readUsers } from '@/lib/sheet-table';
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getGoogleSheets } from "@/lib/google-sheets";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email || (profile && 'email_verified' in profile && profile.email_verified !== true)) return false;
      try {
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Read Users by named headers across the complete worksheet.
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Users',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          console.log("Users 表格找不到資料");
          return false; // 拒絕登入
        }

        const userEmail = user.email;
        // Validate the email, role and company using the same schema as API authorization.
        const isAllowed = readUsers(rows).some(row => row.email.toLowerCase() === userEmail?.toLowerCase() && ['Admin', 'User'].includes(row.role) && (row.role === 'Admin' || Boolean(row.company)));

        if (isAllowed) {
          return true; // 允許登入
        } else {
          return false; // 拒絕登入，NextAuth 會自動阻擋並導向錯誤頁面
        }
      } catch (error) {
        console.error("驗證登入時發生錯誤:", error);
        return false; // 發生錯誤也拒絕登入策安全
      }
    }
  }
});

export { handler as GET, handler as POST };
