import "./globals.css";
import { AppShell } from "../components/app-shell";
import { AuthProvider } from "../components/auth-provider";

export const metadata = {
  title: "주제 글쓰기",
  description: "초등 글쓰기 피드백 앱",
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
