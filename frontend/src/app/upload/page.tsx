"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return alert("Ajoute un nom et une image.");

    setLoading(true);

    try {
      // 🔹 Nom unique du fichier dans le bucket
      const filePath = `${Date.now()}-${file.name}`;

      // 1️⃣ Upload vers le bucket "image"
      const { error: uploadError } = await supabase.storage
        .from("image") // nom du BUCKET
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2️⃣ Récupération de l’URL publique
      const { data } = supabase.storage.from("image").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // 3️⃣ Insertion dans la table "images"
      const { error: dbError } = await supabase
        .from("images") // nom de la TABLE
        .insert([{ name, url: publicUrl }]);

      if (dbError) throw dbError;

      setImageUrl(publicUrl);
      setName("");
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      alert("Erreur : " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }}>
      <h2>🖼️ Upload Image Supabase</h2>
      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Nom de l'image"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", margin: "10px auto", width: "100%" }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: "block", margin: "10px auto" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#1976d2",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
          }}
        >
          {loading ? "Envoi..." : "Envoyer"}
        </button>
      </form>

      {imageUrl && (
        <div style={{ marginTop: 30 }}>
          <h4>Image envoyée :</h4>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Uploaded"
            style={{ width: "100%", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
