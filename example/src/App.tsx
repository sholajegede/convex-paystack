import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

export default function App() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(500000);
  const [reference, setReference] = useState<string | null>(null);

  const initializeTransaction = useAction(api.example.initializeTransaction);
  const transaction = useQuery(
    api.example.getTransaction,
    reference ? { reference } : "skip",
  );
  const hasActiveSubscription = useQuery(
    api.example.hasActiveSubscription,
    email ? { customerEmail: email } : "skip",
  );

  async function pay() {
    const result = await initializeTransaction({
      email,
      amount,
      callbackUrl: window.location.href,
    });
    setReference(result.reference);
    window.location.href = result.authorizationUrl;
  }

  return (
    <main className="app">
      <h1>convex-paystack</h1>
      <p>Accept payments and subscriptions with Paystack in your Convex app.</p>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <label>
        Amount (kobo)
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </label>

      <button onClick={pay} disabled={!email || amount <= 0}>
        Pay with Paystack
      </button>

      {transaction && (
        <p>
          Transaction <code>{transaction.reference}</code> is{" "}
          <strong>{transaction.status}</strong>.
        </p>
      )}

      {email && (
        <p>
          Active subscription: <strong>{String(hasActiveSubscription)}</strong>
        </p>
      )}
    </main>
  );
}
