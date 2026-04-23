"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CreditCard, Lock, Heart, Check, ChevronRight, ChevronLeft,
  Building2, Gift, Wallet,
} from "lucide-react";
import { formatUsd, centsFromDollars, getActiveMatcher } from "@/lib/campaign";
import type {
  CampaignSnapshot,
  CampaignTier,
  CampaignCause,
  CampaignTeamWithProgress,
  CampaignMatcher,
  PaymentMethod,
} from "@/types/campaign";

interface Props {
  open: boolean;
  onClose: () => void;
  snapshot: CampaignSnapshot;
  preselectedTierId?: string | null;
  preselectedTeamId?: string | null;
  onDonated?: () => void;
}

type Step = "amount" | "details" | "payment" | "success";

interface DonateForm {
  name: string;
  email: string;
  phone: string;
  isAnonymous: boolean;
  message: string;
  dedicationType: "" | "honor" | "memory";
  dedicationName: string;
  dedicationEmail: string;
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  dafSponsor: string;
  ojcAccountId: string;
  dfDonor: string;      // Donor's Fund Giving Card # or email
  dfAuth: string;       // Donor's Fund CVV or PIN
}

export default function DonateModal({
  open,
  onClose,
  snapshot,
  preselectedTierId,
  preselectedTeamId,
  onDonated,
}: Props) {
  const { campaign, tiers, causes, teams, matchers } = snapshot;
  const activeMatcher = useMemo(() => getActiveMatcher(matchers), [matchers]);

  const [step, setStep] = useState<Step>("amount");

  const [amountDollars, setAmountDollars] = useState<number | "">("");
  const [tierId, setTierId] = useState<string | null>(preselectedTierId ?? null);
  const [causeId, setCauseId] = useState<string | null>(causes[0]?.id ?? null);
  const [teamId, setTeamId] = useState<string | null>(preselectedTeamId ?? null);

  const [form, setForm] = useState<DonateForm>({
    name: "",
    email: "",
    phone: "",
    isAnonymous: false,
    message: "",
    dedicationType: "",
    dedicationName: "",
    dedicationEmail: "",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    dafSponsor: "",
    ojcAccountId: "",
    dfDonor: "",
    dfAuth: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedTierId) {
      setTierId(preselectedTierId);
      const t = tiers.find((x) => x.id === preselectedTierId);
      if (t) setAmountDollars(Math.round(t.amount_cents / 100));
    }
  }, [preselectedTierId, tiers]);

  useEffect(() => {
    if (preselectedTeamId) setTeamId(preselectedTeamId);
  }, [preselectedTeamId]);

  const amountCents = useMemo(
    () => (typeof amountDollars === "number" ? centsFromDollars(amountDollars) : 0),
    [amountDollars]
  );

  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const selectTier = (t: CampaignTier) => {
    setTierId(t.id);
    setAmountDollars(Math.round(t.amount_cents / 100));
  };

  const selectCustom = (val: string) => {
    setTierId(null);
    const n = parseInt(val, 10);
    setAmountDollars(Number.isFinite(n) && n > 0 ? n : "");
  };

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm({ ...form, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

  const formatExpiry = (v: string, prev: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length >= 2 && v.length > prev.length) return d.slice(0, 2) + "/" + d.slice(2);
    if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
    return d;
  };

  const goToDetails = () => {
    if (!amountDollars || amountCents < 100) {
      setError("Please choose an amount (minimum $1).");
      return;
    }
    setError(null);
    setStep("details");
  };

  const goToPayment = () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email.");
      return;
    }
    setError(null);
    setStep("payment");
  };

  const submit = async () => {
    setError(null);

    if (paymentMethod === "card") {
      const num = form.cardNumber.replace(/\s/g, "");
      if (num.length < 13) return setError("Please enter a valid card number.");
      if (!form.cardExpiry.includes("/")) return setError("Enter expiry as MM/YY.");
      if (form.cardCvv.length < 3) return setError("Please enter the CVV.");
    }
    if (paymentMethod === "daf" && !form.dafSponsor.trim()) {
      return setError("Please tell us which DAF sponsor (e.g. Fidelity Charitable).");
    }
    if (paymentMethod === "donors_fund") {
      if (!form.dfDonor.trim()) return setError("Please enter your Giving Card number or Donor's Fund email.");
      if (!form.dfAuth.trim()) return setError("Please enter your CVV (for card) or PIN (for email login).");
    }

    setSubmitting(true);
    try {
      const payload = {
        amount_cents: amountCents,
        tier_id: tierId,
        cause_id: causeId,
        team_id: teamId,
        payment_method: paymentMethod,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        is_anonymous: form.isAnonymous,
        message: form.message.trim() || null,
        dedication_type: form.dedicationType || null,
        dedication_name: form.dedicationName.trim() || null,
        dedication_email: form.dedicationEmail.trim() || null,
        card: paymentMethod === "card" ? {
          name: form.cardName || form.name,
          number: form.cardNumber.replace(/\s/g, ""),
          expiry: form.cardExpiry,
          cvv: form.cardCvv,
        } : null,
        daf_sponsor: paymentMethod === "daf" ? form.dafSponsor.trim() : null,
        ojc_account_id: paymentMethod === "ojc_fund" ? form.ojcAccountId.trim() : null,
        donors_fund: paymentMethod === "donors_fund" ? {
          donor: form.dfDonor.trim(),
          authorization: form.dfAuth.trim(),
        } : null,
      };

      const res = await fetch(`/api/campaign/${campaign.slug}/donate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Donation failed");

      setStep("success");
      onDonated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Donation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const activeTier = tiers.find((t) => t.id === tierId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div className="min-h-screen flex items-start justify-center p-4 py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="relative bg-gradient-to-b from-[#2d3748] to-[#1a202c] text-white px-6 py-5">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#EF8046] font-semibold mb-1">
                Donate
              </div>
              <h2 className="text-xl font-bold">{campaign.title}</h2>
              {step !== "success" && (
                <div className="flex items-center gap-1.5 mt-3">
                  {(["amount", "details", "payment"] as Step[]).map((s, i) => {
                    const order = ["amount", "details", "payment"];
                    const active = order.indexOf(step) >= i;
                    return (
                      <div
                        key={s}
                        className={`h-1 flex-1 rounded-full ${active ? "bg-[#EF8046]" : "bg-white/15"}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6">
              {error && step !== "success" && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {step === "amount" && (
                <AmountStep
                  tiers={tiers}
                  causes={causes}
                  teams={teams}
                  matcher={activeMatcher}
                  amountCents={amountCents}
                  amountDollars={amountDollars}
                  tierId={tierId}
                  causeId={causeId}
                  teamId={teamId}
                  onPickTier={selectTier}
                  onPickCustom={selectCustom}
                  onPickCause={setCauseId}
                  onPickTeam={setTeamId}
                  onNext={goToDetails}
                />
              )}

              {step === "details" && (
                <DetailsStep
                  form={form}
                  onChange={change}
                  allowAnonymous={campaign.allow_anonymous}
                  allowDedication={campaign.allow_dedication}
                  onBack={() => setStep("amount")}
                  onNext={goToPayment}
                  amountCents={amountCents}
                  activeTierLabel={activeTier?.label}
                />
              )}

              {step === "payment" && (
                <PaymentStep
                  form={form}
                  onChange={change}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  amountCents={amountCents}
                  submitting={submitting}
                  onBack={() => setStep("details")}
                  onSubmit={submit}
                  formatCardNumber={formatCardNumber}
                  formatExpiry={formatExpiry}
                  cardNumberRef={cardNumberRef}
                  cardExpiryRef={cardExpiryRef}
                  cardCvvRef={cardCvvRef}
                  setForm={setForm}
                />
              )}

              {step === "success" && (
                <SuccessStep
                  amountCents={amountCents}
                  paymentMethod={paymentMethod}
                  onClose={onClose}
                />
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------- step components ----------

function AmountStep({
  tiers, causes, teams, matcher, amountCents, amountDollars, tierId, causeId, teamId,
  onPickTier, onPickCustom, onPickCause, onPickTeam, onNext,
}: {
  tiers: CampaignTier[];
  causes: CampaignCause[];
  teams: CampaignTeamWithProgress[];
  matcher: CampaignMatcher | null;
  amountCents: number;
  amountDollars: number | "";
  tierId: string | null;
  causeId: string | null;
  teamId: string | null;
  onPickTier: (t: CampaignTier) => void;
  onPickCustom: (v: string) => void;
  onPickCause: (id: string | null) => void;
  onPickTeam: (id: string | null) => void;
  onNext: () => void;
}) {
  const multiplier = matcher ? Number(matcher.multiplier) : 1;
  const matchedCents = matcher && amountCents > 0
    ? Math.round(amountCents * Math.max(0, multiplier - 1))
    : 0;
  const totalCents = amountCents + matchedCents;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Choose an amount</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {tiers.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPickTier(t)}
            className={`relative py-3 px-2 rounded-xl font-bold text-sm transition-all ${
              tierId === t.id
                ? "bg-[#EF8046] text-white shadow-md"
                : "bg-gray-50 border border-gray-200 text-gray-700 hover:border-[#EF8046]"
            }`}
          >
            {t.is_featured && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
                Popular
              </span>
            )}
            <div>{formatUsd(t.amount_cents)}</div>
            {t.label && <div className="text-[10px] font-medium opacity-80 mt-0.5">{t.label}</div>}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
        <input
          type="number"
          inputMode="numeric"
          value={amountDollars === "" ? "" : amountDollars}
          onChange={(e) => onPickCustom(e.target.value)}
          placeholder="Custom amount"
          min={1}
          className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none transition-all"
        />
      </div>

      {matcher && multiplier > 1 && amountCents > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-[#EF8046]/25 bg-gradient-to-r from-[#fff5f0] to-[#fef7e6]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-[#EF8046] text-white text-[11px] font-bold tracking-wide">
              x{multiplier} MATCH
            </span>
            <div className="flex-1 text-sm leading-tight">
              <div className="text-gray-900 font-semibold tabular-nums">
                Your {formatUsd(amountCents)} becomes {formatUsd(totalCents)}
              </div>
              <div className="text-xs text-gray-600">
                <span className="font-medium">{matcher.name}</span> adds {formatUsd(matchedCents)}
              </div>
            </div>
          </div>
        </div>
      )}

      {causes.length > 1 && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Direct my gift to
          </label>
          <div className="grid grid-cols-2 gap-2">
            {causes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPickCause(c.id)}
                className={`text-left p-3 rounded-xl border text-sm transition-all ${
                  causeId === c.id
                    ? "border-[#EF8046] bg-[#fff5f0]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="font-semibold text-gray-900">{c.name}</div>
                {c.description && <div className="text-xs text-gray-500 mt-0.5">{c.description}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {teams.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Credit a team (optional)
          </label>
          <select
            value={teamId ?? ""}
            onChange={(e) => onPickTeam(e.target.value || null)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="w-full py-4 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_8px_30px_rgba(239,128,70,0.35)] transition-all"
      >
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function DetailsStep({
  form, onChange, allowAnonymous, allowDedication, onBack, onNext, amountCents, activeTierLabel,
}: {
  form: DonateForm;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  allowAnonymous: boolean;
  allowDedication: boolean;
  onBack: () => void;
  onNext: () => void;
  amountCents: number;
  activeTierLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Your info</h3>
        <span className="text-xs text-gray-500">
          {formatUsd(amountCents)}{activeTierLabel ? ` • ${activeTierLabel}` : ""}
        </span>
      </div>

      <div className="space-y-3">
        <Input label="Full name *" name="name" value={form.name} onChange={onChange} autoComplete="name" />
        <Input label="Email *" name="email" type="email" value={form.email} onChange={onChange} autoComplete="email" />
        <Input label="Phone (optional)" name="phone" value={form.phone} onChange={onChange} autoComplete="tel" />

        {allowAnonymous && (
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" name="isAnonymous" checked={form.isAnonymous} onChange={onChange}
              className="w-4 h-4 rounded border-gray-300 text-[#EF8046] focus:ring-[#EF8046]" />
            <span className="text-sm text-gray-700">List me as Anonymous on the donor wall</span>
          </label>
        )}

        {allowDedication && (
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Dedicate this gift (optional)
            </label>
            <select name="dedicationType" value={form.dedicationType} onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm mb-2">
              <option value="">No dedication</option>
              <option value="honor">In honor of</option>
              <option value="memory">In memory of</option>
            </select>
            {form.dedicationType && (
              <div className="space-y-2">
                <input name="dedicationName" value={form.dedicationName} onChange={onChange}
                  placeholder="Name of honoree"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm" />
                <input name="dedicationEmail" value={form.dedicationEmail} onChange={onChange}
                  placeholder="Honoree's email (optional — we'll notify them)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm" />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
            Message on donor wall (optional)
          </label>
          <textarea
            name="message"
            value={form.message}
            onChange={onChange}
            rows={2}
            maxLength={240}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm resize-none focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none"
            placeholder="Share why you gave..."
          />
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onBack}
          className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center gap-1 hover:bg-gray-200 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button type="button" onClick={onNext}
          className="flex-1 py-3 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_8px_30px_rgba(239,128,70,0.35)] transition-all">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function PaymentStep({
  form, onChange, paymentMethod, setPaymentMethod, amountCents, submitting, onBack, onSubmit,
  formatCardNumber, formatExpiry, cardNumberRef, cardExpiryRef, cardCvvRef, setForm,
}: {
  form: DonateForm;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  amountCents: number;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  formatCardNumber: (v: string) => string;
  formatExpiry: (v: string, prev: string) => string;
  cardNumberRef: React.RefObject<HTMLInputElement | null>;
  cardExpiryRef: React.RefObject<HTMLInputElement | null>;
  cardCvvRef: React.RefObject<HTMLInputElement | null>;
  setForm: React.Dispatch<React.SetStateAction<DonateForm>>;
}) {
  const methodBtn = (m: PaymentMethod, label: string, Icon: React.ElementType, subtitle: string) => (
    <button
      key={m}
      type="button"
      onClick={() => setPaymentMethod(m)}
      className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${
        paymentMethod === m
          ? "border-[#EF8046] bg-[#fff5f0]"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <Icon className={`w-5 h-5 ${paymentMethod === m ? "text-[#EF8046]" : "text-gray-500"}`} />
      <div className="flex-1">
        <div className="font-semibold text-sm text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
      {paymentMethod === m && <Check className="w-4 h-4 text-[#EF8046]" />}
    </button>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Payment</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Lock className="w-3 h-3 text-green-500" /> Secure
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {methodBtn("card", "Credit / Debit card", CreditCard, "Charged immediately — instant receipt")}
        {methodBtn("donors_fund", "The Donors' Fund", Wallet, "Charge your Giving Card — instant, no fees")}
        {methodBtn("daf", "Donor-Advised Fund", Gift, "Fidelity, Schwab, JCF, etc. — we'll send instructions")}
        {methodBtn("ojc_fund", "OJC Fund", Building2, "Grant request from your OJC Fund account")}
      </div>

      {paymentMethod === "card" && (
        <div className="bg-[#FAFAFA] rounded-2xl p-4 space-y-3 border border-gray-100">
          <Input label="Name on card" name="cardName" value={form.cardName} onChange={onChange} autoComplete="cc-name" />
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Card number</label>
            <div className="relative">
              <input
                ref={cardNumberRef}
                type="text"
                inputMode="numeric"
                value={form.cardNumber}
                onChange={(e) => {
                  const formatted = formatCardNumber(e.target.value);
                  setForm((prev) => ({ ...prev, cardNumber: formatted }));
                  if (formatted.replace(/\s/g, "").length === 16) cardExpiryRef.current?.focus();
                }}
                maxLength={19}
                autoComplete="cc-number"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm bg-white tabular-nums tracking-wide pr-10"
                placeholder="1234 5678 9012 3456"
              />
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Expiry</label>
              <input
                ref={cardExpiryRef}
                type="text"
                inputMode="numeric"
                value={form.cardExpiry}
                onChange={(e) => {
                  const formatted = formatExpiry(e.target.value, form.cardExpiry);
                  setForm((prev) => ({ ...prev, cardExpiry: formatted }));
                  if (formatted.length === 5) cardCvvRef.current?.focus();
                }}
                maxLength={5}
                autoComplete="cc-exp"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm bg-white tabular-nums"
                placeholder="MM / YY"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">CVV</label>
              <input
                ref={cardCvvRef}
                type="text"
                inputMode="numeric"
                value={form.cardCvv}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setForm((prev) => ({ ...prev, cardCvv: d }));
                }}
                maxLength={4}
                autoComplete="cc-csc"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm bg-white tabular-nums"
                placeholder="CVV"
              />
            </div>
          </div>
        </div>
      )}

      {paymentMethod === "donors_fund" && (
        <div className="bg-[#FAFAFA] rounded-2xl p-4 space-y-3 border border-gray-100">
          <p className="text-xs text-gray-600 leading-relaxed">
            Charge your <span className="font-semibold">Donors&apos; Fund</span> Giving Card directly. Enter your 16-digit card + CVV, or your account email + PIN.
          </p>
          <Input
            label="Giving Card # or Account Email"
            name="dfDonor"
            value={form.dfDonor}
            onChange={onChange}
            placeholder="6599 9929 9945 6587 or you@example.com"
            autoComplete="off"
          />
          <Input
            label="CVV (card) or PIN (email)"
            name="dfAuth"
            value={form.dfAuth}
            onChange={onChange}
            placeholder="476 or 1234"
            autoComplete="off"
          />
        </div>
      )}

      {paymentMethod === "daf" && (
        <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-600 mb-3">
            Pledge now — we&apos;ll email you instructions to request the grant from your DAF sponsor. Your pledge counts toward the campaign goal immediately.
          </p>
          <Input label="DAF sponsor name *" name="dafSponsor" value={form.dafSponsor} onChange={onChange}
            placeholder="Fidelity Charitable, Schwab Charitable, Jewish Communal Fund..." />
        </div>
      )}

      {paymentMethod === "ojc_fund" && (
        <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-600 mb-3">
            OJC Fund account holders: pledge now and we&apos;ll email you a prefilled grant request link for JRE.
          </p>
          <Input label="OJC account # (optional)" name="ojcAccountId" value={form.ojcAccountId} onChange={onChange}
            placeholder="OJC-XXXXXX" />
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onBack}
          className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center gap-1 hover:bg-gray-200 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || amountCents <= 0}
          className="flex-1 py-3 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_8px_30px_rgba(239,128,70,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Processing...
            </>
          ) : (
            <>
              <Heart className="w-4 h-4" />
              {paymentMethod === "card" || paymentMethod === "donors_fund"
                ? `Donate ${formatUsd(amountCents)}`
                : `Pledge ${formatUsd(amountCents)}`}
            </>
          )}
        </button>
      </div>
      <p className="text-center text-gray-500 text-[11px] mt-3">
        Tax-deductible. JRE is a 501(c)(3) nonprofit.
      </p>
    </div>
  );
}

function SuccessStep({
  amountCents, paymentMethod, onClose,
}: { amountCents: number; paymentMethod: PaymentMethod; onClose: () => void }) {
  const isPledge = paymentMethod !== "card" && paymentMethod !== "donors_fund";
  return (
    <div className="text-center py-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <Check className="w-8 h-8 text-green-500" />
      </motion.div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        {isPledge ? "Pledge received!" : "Thank you!"}
      </h3>
      <p className="text-gray-600 mb-5">
        {isPledge
          ? `Your ${formatUsd(amountCents)} pledge is recorded. Check your email — we've sent next steps to complete your grant.`
          : `Your ${formatUsd(amountCents)} donation has been processed. A receipt is on its way to your inbox.`}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
      >
        Close
      </button>
    </div>
  );
}

// ---------- small shared pieces ----------

function Input({
  label, name, value, onChange, type = "text", placeholder, autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all"
      />
    </div>
  );
}
