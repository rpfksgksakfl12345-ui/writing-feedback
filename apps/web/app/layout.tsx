import "./globals.css";
import { AppShell } from "../components/app-shell";
import { AuthProvider } from "../components/auth-provider";

export const metadata = {
  title: "공책톡톡",
  description: "손글씨 공책과 AI 피드백을 연결하는 초등 글쓰기 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
