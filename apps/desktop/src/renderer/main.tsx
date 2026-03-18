import { lazy, StrictMode, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./shared/components/error-boundary";
import { UpdateNotification } from "./shared/components/update-notification";
import { useAuth } from "./shared/hooks/use-auth";
import "./shared/styles/index.css";

const LoginPage = lazy(async () => {
  const module = await import("./features/auth/login-page");
  return { default: module.LoginPage };
});

const DashboardPage = lazy(async () => {
  const module = await import("./features/dashboard/dashboard-page");
  return { default: module.DashboardPage };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const App = () => {
  const { status, signOut, oauthError } = useAuth();

  if (status === "loading") {
    return <AppBootSplash label="Iniciando..." />;
  }

  if (status === "authenticated") {
    return (
      <>
        <Suspense fallback={<AppBootSplash label="Cargando espacio de trabajo..." />}>
          <DashboardPage onSignOut={signOut} />
        </Suspense>
        <UpdateNotification />
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<AppBootSplash label="Cargando autenticacion..." />}>
        <LoginPage oauthError={oauthError} />
      </Suspense>
      <UpdateNotification />
    </>
  );
};

const AppBootSplash = ({ label }: { label: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#0B0F14]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      <p className="text-[9px] text-[#7C8798] font-bold tracking-widest uppercase">
        {label}
      </p>
    </div>
  </div>
);

window.addEventListener("error", (event) => {
  console.error("[Renderer Global Error]", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Renderer Unhandled Rejection]", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
