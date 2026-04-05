"use client";

// Client component for the cleanup button.
// Uses fetch() to call the cleanup API and shows the result inline
// instead of navigating away from the page.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CleanupButton({ adminKey }: { adminKey?: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleCleanup() {
    if (!confirm("Delete trace events older than 7 days?")) return;

    setStatus("loading");
    try {
      const url = `/api/admin/traces/cleanup${adminKey ? `?key=${adminKey}` : ""}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage(`Deleted ${data.deleted} old events`);
        router.refresh();
      } else {
        setMessage(data.error ?? "Cleanup failed");
      }
    } catch {
      setMessage("Network error");
    }
    setStatus("done");
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div className="flex items-center gap-2">
      {status === "done" && (
        <span className="text-xs text-gray-500">{message}</span>
      )}
      <button
        type="button"
        onClick={handleCleanup}
        disabled={status === "loading"}
        title="Delete trace events older than 7 days"
        className="rounded-lg border-2 border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {status === "loading" ? "Cleaning..." : "Run Cleanup Now"}
      </button>
    </div>
  );
}
