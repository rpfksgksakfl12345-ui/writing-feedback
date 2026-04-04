import "./globals.css";
import { AppShell } from "../components/app-shell";
import { AuthProvider } from "../components/auth-provider";

export const metadata = {
  title: "Writing Feedback MVP",
  description: "Elementary writing feedback web app",
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
