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

        // 讀取 Users 工作表的 A 到 D 欄
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Users!A:D',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
          console.log("Users 表格找不到資料");
          return false; // 拒絕登入
        }

        const userEmail = user.email;
        // 檢查登入的信箱是否有在 A 欄 (row[0]) 之中
        const isAllowed = rows.slice(1).some((row) => String(row[0]).toLowerCase() === userEmail?.toLowerCase() && ['Admin', 'User'].includes(String(row[1])) && (row[1] === 'Admin' || Boolean(row[2])));

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
