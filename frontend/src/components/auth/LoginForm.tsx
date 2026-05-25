"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

function getErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  if ("detail" in data && typeof data.detail === "string") return data.detail;
  if ("message" in data && typeof data.message === "string") return data.message;
  return fallback;
}

export default function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("authToken", data.access_token);

        if (data.user?.id) {
          localStorage.setItem("userId", data.user.id);
        }

        setMessage({ type: "success", text: "Connexion réussie." });
        setTimeout(() => router.push("/"), 1000);
      } else {
        setMessage({
          type: "error",
          text: getErrorMessage(data, "Identifiants incorrects."),
        });
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau. Réessayez." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-lg bg-white/90 p-6 shadow-md dark:bg-gray-800/80"
    >
      <h2 className="mb-2 text-center text-2xl font-semibold text-[var(--color-primary)]">
        Connexion
      </h2>

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Adresse email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
          className="w-full rounded-md border p-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Mot de passe</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          required
          className="w-full rounded-md border p-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[var(--color-primary)] py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Connexion..." : "Se connecter"}
      </button>

      <p className="mt-2 text-center text-sm">
        Pas encore de compte ?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-[var(--color-primary)] hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
