import { useEffect, useState } from "react";
import { Header, type Screen } from "./components/Header";
import { TopBanner } from "./components/TopBanner";
import { Home } from "./components/Home";
import { OneTimePayment } from "./components/OneTimePayment";
import { SubscriptionPayment } from "./components/SubscriptionPayment";
import { Result } from "./components/Result";
import { History } from "./components/History";
import { Console } from "./components/Console";
import { LogProvider } from "./components/LogProvider";
import type { PendingAttempt } from "./lib/pendingAttempt";
import "./theme.css";
import "./App.css";

// Paystack redirects back to callback_url with ?trxref=...&reference=...
// after the customer completes (or abandons) checkout. Read that once, up
// front, as lazy initial state rather than in an effect — an effect that
// turns around and calls setState on mount just causes an extra render.
function readCheckoutReturn(): { reference: string | null; screen: Screen } {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") ?? params.get("trxref");
  return { reference, screen: reference ? "result" : "home" };
}

function AppShell() {
  const [initial] = useState(readCheckoutReturn);
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [email, setEmail] = useState("");
  const reference = initial.reference;
  const [banner, setBanner] = useState<string | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(true);

  // Strip the Paystack query params from the URL once we've consumed them,
  // so a page refresh on the result screen doesn't re-trigger navigation.
  useEffect(() => {
    if (initial.reference) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [initial.reference]);

  function navigate(next: Screen) {
    setBanner(null);
    setScreen(next);
  }

  function handleRetry(attempt: PendingAttempt | null) {
    setBanner(null);
    navigate(attempt?.kind === "subscription" ? "subscription" : "one-time");
  }

  return (
    <div className={`app-shell ${consoleOpen ? "app-shell--console-open" : ""}`}>
      <TopBanner />
      <Header screen={screen} onNavigate={navigate} />

      <main className="app-main">
        {banner && <div className="banner banner--error">{banner}</div>}

        {screen === "home" && <Home onNavigate={navigate} />}

        {screen === "one-time" && (
          <OneTimePayment email={email} setEmail={setEmail} onError={setBanner} />
        )}

        {screen === "subscription" && (
          <SubscriptionPayment email={email} setEmail={setEmail} onError={setBanner} />
        )}

        {screen === "result" && reference && (
          <Result
            reference={reference}
            onRetry={handleRetry}
            onDone={() => navigate("home")}
          />
        )}

        {screen === "history" && <History email={email} setEmail={setEmail} />}
      </main>

      <footer className="app-footer">
        <span className="app-footer__brand">convex-paystack</span>
        <span className="app-footer__sep" aria-hidden="true">
          ·
        </span>
        Test mode only — see the banner above for test card numbers.
      </footer>

      <Console open={consoleOpen} onOpenChange={setConsoleOpen} />
    </div>
  );
}

export default function App() {
  return (
    <LogProvider>
      <AppShell />
    </LogProvider>
  );
}
