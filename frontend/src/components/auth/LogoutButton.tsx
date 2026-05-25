"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    router.push("/auth/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600"
    >
      Déconnexion
    </button>
  );
}
