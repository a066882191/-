import { useEffect } from 'react';
import { BrowserRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { BottomNav } from "./components/feature/BottomNav";
import { useAuth } from "./hooks/useAuth";
import { loadEmployees } from "./mocks/employees";
import ErrorBoundary from "./components/feature/ErrorBoundary";

function NavWrapper() {
  const { user } = useAuth();
  const location = useLocation();
  const hideNavPaths = ["/"];
  const showNav = user && !hideNavPaths.includes(location.pathname);

  useEffect(() => {
    loadEmployees()
      .then(() => {
        import("@/hooks/useAuth")
          .then((mod) => {
            mod.refreshCurrentUser();
          })
          .catch((err) => {
            console.error("refreshCurrentUser import failed:", err);
          });
      })
      .catch((err) => {
        console.error("loadEmployees failed:", err);
      });
  }, []);

  return (
    <>
      <AppRoutes />
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={__BASE_PATH__}>
        <ErrorBoundary onReset={() => window.location.reload()}>
          <NavWrapper />
        </ErrorBoundary>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;