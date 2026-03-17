"use client";

import { useState } from "react";
import { Upload, Database, FileText, CheckCircle, AlertCircle, Loader2, Terminal } from "lucide-react";

type ImportStatus = "idle" | "loading" | "success" | "error";

interface ImportResult {
  contactsCreated?: number;
  contactsUpdated?: number;
  interactionsCreated?: number;
  errors?: string[];
}

export default function ImportPage() {
  const [migrateStatus, setMigrateStatus] = useState<ImportStatus>("idle");
  const [migrateResult, setMigrateResult] = useState<any>(null);
  const [showSql, setShowSql] = useState(false);

  const [registrationsStatus, setRegistrationsStatus] = useState<ImportStatus>("idle");
  const [registrationsResult, setRegistrationsResult] = useState<any>(null);

  const [sheetsStatus, setSheetsStatus] = useState<ImportStatus>("idle");
  const [sheetsResult, setSheetsResult] = useState<any>(null);

  const [banquestStatus, setBanquestStatus] = useState<ImportStatus>("idle");
  const [banquestResult, setBanquestResult] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  async function runRegistrationsImport() {
    setRegistrationsStatus("loading");
    setRegistrationsResult(null);
    const res = await fetch("/api/admin/outreach/import/registrations", { method: "POST" });
    const data = await res.json();
    setRegistrationsResult(data);
    setRegistrationsStatus(data.success ? "success" : "error");
  }

  async function runSheetsImport() {
    setSheetsStatus("loading");
    setSheetsResult(null);
    const res = await fetch("/api/admin/outreach/import/sheets", { method: "POST" });
    const data = await res.json();
    setSheetsResult(data);
    setSheetsStatus(data.success ? "success" : "error");
  }

  async function runBanquestImport() {
    if (!csvFile) return;
    setBanquestStatus("loading");
    setBanquestResult(null);
    const form = new FormData();
    form.append("file", csvFile);
    const res = await fetch("/api/admin/outreach/import/banquest", { method: "POST", body: form });
    const data = await res.json();
    setBanquestResult(data);
    setBanquestStatus(data.success ? "success" : "error");
  }

  async function runMigration() {
    setMigrateStatus("loading");
    setMigrateResult(null);
    const res = await fetch("/api/admin/outreach/migrate", { method: "POST" });
    const data = await res.json();
    setMigrateResult(data);
    setMigrateStatus(data.success ? "success" : "error");
    if (!data.success) setShowSql(true);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Setup & Import</h1>
        <p className="text-gray-500 mt-1">Run these in order to set up the CRM and import your existing data.</p>
      </div>

      {/* Step 0: Database Migration */}
      <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Terminal className="w-5 h-5 text-blue-600" /></div>
          <div className="flex-1">
            <div className="text-xs font-medium text-blue-500 uppercase tracking-wide">Step 0 — Do This First</div>
            <h3 className="font-semibold text-gray-900">Create Database Tables</h3>
            <p className="text-sm text-gray-500 mt-1">
              Creates the 3 CRM tables in your Supabase database. Only needs to run once.
            </p>
          </div>
          <button
            onClick={runMigration}
            disabled={migrateStatus === "loading" || migrateStatus === "success"}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {migrateStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {migrateStatus === "success" ? "✓ Done" : "Create Tables"}
          </button>
        </div>

        {migrateResult && (
          <div className={`rounded-xl p-4 space-y-3 ${migrateResult.success ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
            {migrateResult.success ? (
              <div className="flex gap-2 text-green-800 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Tables created successfully! Proceed to Step 1.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 text-yellow-800 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Automatic migration not available. Run the SQL manually in Supabase:</span>
                </div>
                <ol className="text-sm text-yellow-800 space-y-1 pl-4 list-decimal">
                  {migrateResult.manualSteps?.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <button
                  onClick={() => setShowSql(!showSql)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {showSql ? "Hide SQL" : "Show SQL to copy"}
                </button>
                {showSql && migrateResult.sql && (
                  <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {migrateResult.sql}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 1: Website Data */}
      <ImportCard
        icon={<Database className="w-5 h-5 text-blue-500" />}
        step="Step 1"
        title="Website Registrations & Donations"
        description="Imports everyone who ever registered for an event, donated, or filled out a contact form on your website. Already stored in your database — no file needed."
        status={registrationsStatus}
        result={registrationsResult}
        onRun={runRegistrationsImport}
        buttonLabel="Import from Website"
        resultRenderer={(r) => r?.sources && (
          <div className="text-sm space-y-1">
            <p>Event registrations: <strong>{r.sources.eventRegistrations}</strong></p>
            <p>Email signups: <strong>{r.sources.emailSignups}</strong></p>
            <p>Donations: <strong>{r.sources.donations}</strong></p>
            <ImportResultSummary result={r.importResult} />
          </div>
        )}
      />

      {/* Step 2: Google Sheets */}
      <ImportCard
        icon={<FileText className="w-5 h-5 text-green-500" />}
        step="Step 2"
        title="Google Sheets Audit"
        description="Reads ALL tabs in your Google Sheets spreadsheet, extracts every person found (name, email, phone), and adds them as contacts with event interactions."
        status={sheetsStatus}
        result={sheetsResult}
        onRun={runSheetsImport}
        buttonLabel="Scan Google Sheets"
        resultRenderer={(r) => r?.tabsSummary && (
          <div className="text-sm space-y-1">
            <p>Tabs scanned: <strong>{r.tabsSummary.length}</strong> · Total rows: <strong>{r.totalRows}</strong></p>
            {r.tabsSummary.filter((t: any) => t.peopleFound > 0).map((t: any) => (
              <p key={t.name} className="text-gray-600">{t.name}: {t.peopleFound} people</p>
            ))}
            <ImportResultSummary result={r.importResult} />
          </div>
        )}
      />

      {/* Step 3: Banquest */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-50 rounded-lg"><Upload className="w-5 h-5 text-orange-500" /></div>
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Step 3</div>
            <h3 className="font-semibold text-gray-900">Banquest Donor History</h3>
            <p className="text-sm text-gray-500 mt-1">
              Export your donor history from the Banquest dashboard as a CSV file. Upload it here and every donor — years of giving — will be imported as contacts.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              In Banquest: Reports → Transactions → Export CSV. Any columns with name, email, amount, date will be read automatically.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <label className="flex-1 cursor-pointer">
            <div className={`border-2 border-dashed rounded-xl px-4 py-3 text-center text-sm transition-colors ${csvFile ? "border-orange-300 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
              {csvFile ? (
                <span className="text-orange-700 font-medium">{csvFile.name}</span>
              ) : (
                <span className="text-gray-400">Click to upload CSV file</span>
              )}
            </div>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
          </label>
          <button
            onClick={runBanquestImport}
            disabled={!csvFile || banquestStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#EF8046] text-white rounded-lg hover:bg-[#d96a2f] disabled:opacity-40 transition-colors"
          >
            {banquestStatus === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import Donors
          </button>
        </div>

        {banquestResult && (
          <StatusBox status={banquestStatus} result={banquestResult}>
            {banquestResult.csvStats && (
              <div className="text-sm space-y-1">
                <p>Donors found: <strong>{banquestResult.csvStats.donorsFound}</strong></p>
                <p>Rows processed: <strong>{banquestResult.csvStats.rowsProcessed}</strong> · Skipped: <strong>{banquestResult.csvStats.rowsSkipped}</strong></p>
                <p>Total giving: <strong>${banquestResult.csvStats.totalDonationAmount?.toFixed(2)}</strong></p>
                <ImportResultSummary result={banquestResult.importResult} />
              </div>
            )}
          </StatusBox>
        )}
      </div>

      <div className="text-sm text-gray-400 text-center">
        All imports are safe to run multiple times — duplicates are detected by email and skipped.
      </div>
    </div>
  );
}

function ImportCard({ icon, step, title, description, status, result, onRun, buttonLabel, resultRenderer }: {
  icon: React.ReactNode; step: string; title: string; description: string;
  status: ImportStatus; result: any; onRun: () => void; buttonLabel: string;
  resultRenderer: (r: any) => React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <div className="flex-1">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{step}</div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={status === "loading"}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[#EF8046] text-white rounded-lg hover:bg-[#d96a2f] disabled:opacity-40 transition-colors shrink-0"
        >
          {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {buttonLabel}
        </button>
      </div>
      {result && (
        <StatusBox status={status} result={result}>
          {resultRenderer(result)}
        </StatusBox>
      )}
    </div>
  );
}

function StatusBox({ status, result, children }: { status: ImportStatus; result: any; children: React.ReactNode }) {
  if (status === "error") {
    return (
      <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{result?.error || "Import failed"}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-2 bg-green-50 border border-green-200 rounded-xl p-4">
      <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
      <div className="text-green-800">{children}</div>
    </div>
  );
}

function ImportResultSummary({ result }: { result?: ImportResult }) {
  if (!result) return null;
  return (
    <p className="text-green-700 mt-2 font-medium">
      Created {result.contactsCreated}, updated {result.contactsUpdated}, {result.interactionsCreated} interactions added.
      {result.errors && result.errors.length > 0 && ` (${result.errors.length} errors)`}
    </p>
  );
}
