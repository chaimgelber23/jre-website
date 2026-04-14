"use client";

import { useState, useEffect } from "react";

const CC_API_KEY = "99aae6aa-e950-4d6e-9182-8f31dc2d0abe";

/** Generate PKCE code_verifier and code_challenge in the browser */
async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return { verifier, challenge };
}

export default function ConstantContactAdmin() {
  const [status, setStatus] = useState<string>("Loading...");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check URL params for success/error from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      setStatus("Connected! Constant Contact is now set up with auto-refresh. You're all set.");
      setIsConnected(true);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (params.get("error")) {
      setStatus(`Error: ${params.get("error")}`);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    // Check current token status
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/admin/constant-contact/status");
      const data = await res.json();
      if (data.connected) {
        setIsConnected(true);
        setStatus(`Connected! Token valid until ${new Date(data.expiresAt).toLocaleString()}. Auto-refresh is active.`);
      } else {
        setStatus(data.message || "Not connected. Click below to authorize.");
      }
    } catch {
      setStatus("Not connected. Click below to authorize.");
    }
  };

  const startAuth = async () => {
    const { verifier, challenge } = await generatePKCE();
    const redirectUri = `${window.location.origin}/api/admin/constant-contact/callback`;
    const authUrl = `https://authz.constantcontact.com/oauth2/default/v1/authorize?client_id=${CC_API_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=contact_data+offline_access&code_challenge=${challenge}&code_challenge_method=S256&state=${verifier}`;
    window.location.href = authUrl;
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Constant Contact Integration</h1>

      <div className={`rounded-xl p-6 mb-6 ${isConnected ? "bg-green-50 border border-green-200" : "bg-gray-50"}`}>
        <h2 className="font-semibold mb-2">{isConnected ? "Connected" : "Status"}</h2>
        <p className="text-gray-700">{status}</p>
      </div>

      <button
        onClick={startAuth}
        className="inline-block px-6 py-3 bg-[#EF8046] text-white rounded-lg font-medium hover:bg-[#d96a2f] transition-colors cursor-pointer"
      >
        {isConnected ? "Re-authorize" : "Connect Constant Contact"}
      </button>

      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h2 className="font-semibold mb-2">How it works</h2>
        <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
          <li>When someone registers for an event, their info is auto-added to your &quot;Event registrants&quot; list</li>
          <li>If the contact already exists, no duplicate is created</li>
          <li>Tokens auto-refresh — <strong>no manual work needed</strong> after initial setup</li>
          <li>Only re-authorize here if something breaks</li>
        </ul>
      </div>
    </div>
  );
}
