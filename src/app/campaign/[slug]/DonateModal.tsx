"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  X, CreditCard, Lock, Check, ChevronRight, ChevronLeft,
} from "lucide-react";
import { formatUsd, centsFromDollars, getActiveMatcher } from "@/lib/campaign";
import TurnstileWidget from "@/components/ui/TurnstileWidget";
import type {
  CampaignSnapshot,
  CampaignTier,
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
  preselectedAmountDollars?: number | null;
  onDonated?: () => void;
}

type Step = "details" | "payment" | "success";

const MAX_DISPLAY_NAME = 55;
const MAX_MESSAGE = 75;

interface DonateForm {
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  phoneCountry: string; // "+1"
  isAnonymous: boolean;
  message: string;
  dedicationType: "" | "honor" | "memory";
  dedicationName: string;
  dedicationEmail: string;
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  addrCountry: string;
  addrLine1: string;
  addrApt: string;
  addrZip: string;
  addrCity: string;
  addrState: string;
  dafSponsor: string;
  ojcCardNumber: string;
  ojcExpDate: string;
  dfDonor: string;
  dfAuth: string;
}

const COUNTRIES = [
  { code: "+1", label: "US +1" },
  { code: "+972", label: "IL +972" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+33", label: "FR +33" },
  { code: "+49", label: "DE +49" },
];

export default function DonateModal({
  open,
  onClose,
  snapshot,
  preselectedTierId,
  preselectedTeamId,
  preselectedAmountDollars,
  onDonated,
}: Props) {
  const { campaign, tiers, teams, matchers } = snapshot;
  const activeMatcher = useMemo(() => getActiveMatcher(matchers), [matchers]);
  const multiplier = activeMatcher ? Number(activeMatcher.multiplier) : 1;

  const [step, setStep] = useState<Step>("details");

  const [amountDollars, setAmountDollars] = useState<number | "">("");
  const [tierId, setTierId] = useState<string | null>(preselectedTierId ?? null);
  const [teamId, setTeamId] = useState<string | null>(preselectedTeamId ?? null);
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  const [form, setForm] = useState<DonateForm>({
    fullName: "",
    displayName: "",
    email: "",
    phone: "",
    phoneCountry: "+1",
    isAnonymous: false,
    message: "",
    dedicationType: "",
    dedicationName: "",
    dedicationEmail: "",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    addrCountry: "United States",
    addrLine1: "",
    addrApt: "",
    addrZip: "",
    addrCity: "",
    addrState: "",
    dafSponsor: "",
    ojcCardNumber: "",
    ojcExpDate: "",
    dfDonor: "",
    dfAuth: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Preselect logic
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

  useEffect(() => {
    if (preselectedAmountDollars && preselectedAmountDollars > 0 && !preselectedTierId) {
      setAmountDollars(preselectedAmountDollars);
      setTierId(null);
    }
  }, [preselectedAmountDollars, preselectedTierId]);

  // Body scroll lock + Escape to close
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Reset internal state whenever the modal closes, so the next open starts
  // fresh (no stale "success" step, no stale card fields). Preselections are
  // re-applied by the effects above once it reopens.
  useEffect(() => {
    if (open) return;
    setStep("details");
    setAmountDollars("");
    setTierId(null);
    setTeamId(null);
    setFrequency("one_time");
    setPaymentMethod("card");
    setSubmitting(false);
    setError(null);
    setForm({
      fullName: "",
      displayName: "",
      email: "",
      phone: "",
      phoneCountry: "+1",
      isAnonymous: false,
      message: "",
      dedicationType: "",
      dedicationName: "",
      dedicationEmail: "",
      cardName: "",
      cardNumber: "",
      cardExpiry: "",
      cardCvv: "",
      addrCountry: "United States",
      addrLine1: "",
      addrApt: "",
      addrZip: "",
      addrCity: "",
      addrState: "",
      dafSponsor: "",
      ojcCardNumber: "",
      ojcExpDate: "",
      dfDonor: "",
      dfAuth: "",
    });
  }, [open]);

  // When step changes, scroll the modal body back to top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const amountCents = useMemo(
    () => (typeof amountDollars === "number" ? centsFromDollars(amountDollars) : 0),
    [amountDollars]
  );
  const matchedCents = activeMatcher && amountCents > 0
    ? Math.round(amountCents * Math.max(0, multiplier - 1))
    : 0;
  const totalCents = amountCents + matchedCents;
  // Gated behind campaign.allow_recurring: donors only see the Monthly pill
  // once that DB flag is flipped. Until then `isRecurring` stays false and
  // the flow behaves exactly like a one-time donation.
  const isRecurring = campaign.allow_recurring && frequency === "monthly";

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

  const goToPayment = () => {
    setError(null);
    if (!amountDollars || amountCents < 100) return setError("Please choose an amount (minimum $1).");
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.email.trim()) return setError("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Please enter a valid email.");
    setStep("payment");
  };

  const submit = async () => {
    setError(null);

    if (paymentMethod === "card") {
      const num = form.cardNumber.replace(/\s/g, "");
      if (num.length < 13) return setError("Please enter a valid card number.");
      if (!form.cardExpiry.includes("/")) return setError("Enter expiry as MM/YY.");
      if (form.cardCvv.length < 3) return setError("Please enter the CVV.");
      if (!form.addrZip.trim()) return setError("Please enter the billing ZIP code.");
    }
    if (paymentMethod === "daf" && !form.dafSponsor.trim()) {
      return setError("Please tell us which DAF sponsor (e.g. Fidelity Charitable).");
    }
    if (paymentMethod === "donors_fund") {
      if (!form.dfDonor.trim()) return setError("Please enter your Giving Card number or Donor's Fund email.");
      if (!form.dfAuth.trim()) return setError("Please enter your CVV (for card) or PIN (for email login).");
    }
    if (paymentMethod === "ojc_fund") {
      const cardDigits = form.ojcCardNumber.replace(/\s/g, "");
      if (!/^\d{13,19}$/.test(cardDigits)) return setError("Please enter a valid OJC Charity Card number.");
      if (!/^\d{4}$/.test(form.ojcExpDate.trim())) return setError("OJC expiration must be MMYY (e.g. 1226).");
    }
    if (captchaRequired && !captchaToken) {
      return setError("Please wait for verification to finish, then try again.");
    }

    setSubmitting(true);
    try {
      const displayName = form.displayName.trim() || form.fullName.trim();
      const phoneFull = form.phone.trim() ? `${form.phoneCountry} ${form.phone.trim()}` : "";

      const payload = {
        amount_cents: amountCents,
        tier_id: tierId,
        cause_id: null,
        team_id: teamId,
        payment_method: paymentMethod,
        name: form.fullName.trim(),
        display_name: displayName,
        email: form.email.trim(),
        phone: phoneFull || null,
        is_anonymous: form.isAnonymous,
        message: form.message.trim() || null,
        dedication_type: form.dedicationType || null,
        dedication_name: form.dedicationName.trim() || null,
        dedication_email: form.dedicationEmail.trim() || null,
        card: paymentMethod === "card" ? {
          name: form.cardName || form.fullName,
          number: form.cardNumber.replace(/\s/g, ""),
          expiry: form.cardExpiry,
          cvv: form.cardCvv,
          billing: {
            country: form.addrCountry,
            line1: form.addrLine1,
            apt: form.addrApt,
            zip: form.addrZip,
            city: form.addrCity,
            state: form.addrState,
          },
        } : null,
        daf_sponsor: paymentMethod === "daf" ? form.dafSponsor.trim() : null,
        ojc_account_id: null,
        ojc: paymentMethod === "ojc_fund" ? {
          cardNumber: form.ojcCardNumber.replace(/\s/g, ""),
          expDate: form.ojcExpDate.trim(),
        } : null,
        donors_fund: paymentMethod === "donors_fund" ? {
          donor: form.dfDonor.trim(),
          authorization: form.dfAuth.trim(),
        } : null,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? "monthly" : null,
        turnstile_token: captchaToken,
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
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const isPledge = paymentMethod !== "card" && paymentMethod !== "donors_fund" && paymentMethod !== "ojc_fund";
  const displayNameLeft = MAX_DISPLAY_NAME - form.displayName.length;
  const messageLeft = MAX_MESSAGE - form.message.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(92vh, 900px)" }}
        >
          {/* Sticky header */}
          <div className="relative bg-gradient-to-b from-[#2d3748] to-[#1a202c] text-white px-6 py-5 flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#EF8046] font-semibold mb-1">
              Donate · {campaign.title}
            </div>
            <h2 className="text-lg font-bold pr-10">
              {step === "success" ? "Thank you!" : step === "payment" ? "Payment" : "Your Donation"}
            </h2>
            {step !== "success" && (
              <div className="flex items-center gap-2 mt-3 text-xs text-white/70">
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === "details" || step === "payment" ? "bg-[#EF8046] text-white" : "bg-white/15"}`}>1</span>
                  <span>Details</span>
                </div>
                <div className="h-px flex-1 bg-white/15" />
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === "payment" ? "bg-[#EF8046] text-white" : "bg-white/15"}`}>2</span>
                  <span>Payment</span>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-6 py-5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {error && step !== "success" && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {step === "details" && (
              <DetailsStep
                tiers={tiers}
                teams={teams}
                matcher={activeMatcher}
                allowAnonymous={campaign.allow_anonymous}
                allowDedication={campaign.allow_dedication}
                allowRecurring={campaign.allow_recurring}
                amountDollars={amountDollars}
                amountCents={amountCents}
                matchedCents={matchedCents}
                totalCents={totalCents}
                multiplier={multiplier}
                frequency={frequency}
                tierId={tierId}
                teamId={teamId}
                form={form}
                displayNameLeft={displayNameLeft}
                messageLeft={messageLeft}
                onPickTier={selectTier}
                onPickCustom={selectCustom}
                onPickTeam={setTeamId}
                onSetFrequency={setFrequency}
                onChange={change}
                orgName="Jewish Renaissance Experience"
              />
            )}

            {step === "payment" && (
              <PaymentStep
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                form={form}
                onChange={change}
                setForm={setForm}
                formatCardNumber={formatCardNumber}
                formatExpiry={formatExpiry}
                cardNumberRef={cardNumberRef}
                cardExpiryRef={cardExpiryRef}
                cardCvvRef={cardCvvRef}
                amountCents={amountCents}
                matchedCents={matchedCents}
                totalCents={totalCents}
                isRecurring={isRecurring}
                orgName="Jewish Renaissance Experience"
              />
            )}

            {step === "success" && (
              <SuccessStep
                amountCents={amountCents}
                isPledge={isPledge}
                isRecurring={isRecurring}
                email={form.email.trim()}
                onClose={onClose}
              />
            )}
          </div>

          {/* Sticky footer */}
          {step !== "success" && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-6 py-4">
              {step === "details" && (
                <button
                  type="button"
                  onClick={goToPayment}
                  className="w-full py-3.5 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_8px_30px_rgba(239,128,70,0.35)] transition-all"
                >
                  Continue to Payment <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {step === "payment" && (
                <>
                  {captchaRequired && (
                    <div className="mb-3 flex justify-center">
                      <TurnstileWidget
                        onVerify={setCaptchaToken}
                        onExpire={() => setCaptchaToken(null)}
                        onError={() => setCaptchaToken(null)}
                        resetSignal={captchaReset}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center gap-1 hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || amountCents <= 0}
                    className="flex-1 py-3 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_8px_30px_rgba(239,128,70,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Processing…
                      </>
                    ) : (
                      paymentMethod === "card" || paymentMethod === "donors_fund" || paymentMethod === "ojc_fund"
                        ? `Donate ${formatUsd(amountCents)}${isRecurring ? "/month" : ""}`
                        : `Pledge ${formatUsd(amountCents)}${isRecurring ? "/month" : ""}`
                    )}
                  </button>
                  </div>
                </>
              )}
              <p className="text-center text-gray-400 text-[11px] mt-2.5">
                <Lock className="inline w-3 h-3 mr-1 text-green-500" />
                Secure · tax-deductible · JRE is a 501(c)(3) non-profit
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ======================== STEP 1: DETAILS ========================

function DetailsStep({
  tiers, teams, matcher,
  allowAnonymous, allowDedication, allowRecurring,
  amountDollars, amountCents, matchedCents, totalCents, multiplier,
  frequency,
  tierId, teamId,
  form, displayNameLeft, messageLeft,
  onPickTier, onPickCustom, onPickTeam, onSetFrequency, onChange,
  orgName,
}: {
  tiers: CampaignTier[];
  teams: CampaignTeamWithProgress[];
  matcher: CampaignMatcher | null;
  allowAnonymous: boolean;
  allowDedication: boolean;
  allowRecurring: boolean;
  amountDollars: number | "";
  amountCents: number;
  matchedCents: number;
  totalCents: number;
  multiplier: number;
  frequency: "one_time" | "monthly";
  tierId: string | null;
  teamId: string | null;
  form: DonateForm;
  displayNameLeft: number;
  messageLeft: number;
  onPickTier: (t: CampaignTier) => void;
  onPickCustom: (v: string) => void;
  onPickTeam: (id: string | null) => void;
  onSetFrequency: (f: "one_time" | "monthly") => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  orgName: string;
}) {
  return (
    <div className="space-y-5">
      {/* Amount */}
      <Fieldset label="Your Amount">
        {tiers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 pt-3">
            {tiers.map((t) => {
              const selected = tierId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPickTier(t)}
                  aria-pressed={selected}
                  className={[
                    "relative rounded-xl text-center font-bold transition-all min-h-[68px] px-3 py-3",
                    "active:scale-[0.98]",
                    selected
                      ? "bg-[#EF8046] text-white shadow-md ring-2 ring-[#EF8046]/30"
                      : "bg-gray-50 border border-gray-200 text-gray-900 hover:border-[#EF8046] hover:bg-white",
                  ].join(" ")}
                >
                  {t.is_featured && (
                    <span
                      className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-[3px] rounded-full text-white whitespace-nowrap shadow-sm"
                      style={{ background: "#EF8046" }}
                    >
                      Popular
                    </span>
                  )}
                  <div className="text-base tabular-nums leading-none">{formatUsd(t.amount_cents)}</div>
                  {t.label && (
                    <div
                      className={[
                        "text-[10px] font-semibold uppercase tracking-wide mt-1 leading-tight",
                        selected ? "text-white/85" : "text-gray-500",
                      ].join(" ")}
                    >
                      {t.label}
                    </div>
                  )}
                  {t.hebrew_value && (
                    <div
                      dir="rtl"
                      className={[
                        "text-[11px] font-semibold mt-1 tabular-nums",
                        selected ? "text-white/90" : "text-[#EF8046]",
                      ].join(" ")}
                    >
                      {t.hebrew_value}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-stretch rounded-xl border border-gray-200 bg-[#FAFAFA]">
          <span className="pl-4 pr-2 flex items-center text-gray-500 font-medium text-lg select-none">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountDollars === "" ? "" : amountDollars}
            onChange={(e) => onPickCustom(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
            className="flex-1 min-w-0 py-3 bg-transparent text-xl font-bold tabular-nums text-gray-900 outline-none border-0 focus:outline-none focus:ring-0 focus:border-0"
          />
          <span className="pr-4 pl-2 flex items-center text-gray-400 text-sm font-semibold uppercase tracking-wide select-none">USD</span>
        </div>

        {allowRecurring && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "one_time", label: "One-time", sub: "single donation" },
                { key: "monthly", label: "Monthly", sub: "every month" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSetFrequency(opt.key)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    frequency === opt.key
                      ? "bg-[#EF8046] text-white"
                      : "bg-gray-50 border border-gray-200 text-gray-700 hover:border-[#EF8046]"
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-[11px] font-normal mt-0.5 ${frequency === opt.key ? "text-white/80" : "text-gray-500"}`}>
                    {opt.sub}
                  </div>
                </button>
              ))}
            </div>
            {frequency === "monthly" && amountCents > 0 && (
              <p className="text-[11px] text-gray-600 mt-2 tabular-nums">
                {formatUsd(amountCents)} charged today, then the same amount on this day every month. Cancel anytime by emailing{" "}
                <a href="mailto:office@thejre.org" className="underline">office@thejre.org</a>.
              </p>
            )}
          </div>
        )}

        {matcher && multiplier > 1 && amountCents > 0 && (
          <div className="mt-3 p-3 rounded-xl border border-[#EF8046]/25 bg-gradient-to-r from-[#fff5f0] to-[#fef7e6]">
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

        <p className="text-[11px] text-gray-500 mt-2">
          {orgName} receives:{" "}
          <span className="font-semibold text-gray-700 tabular-nums">{formatUsd(amountCents)}</span>
          {matchedCents > 0 && (
            <> + <span className="font-semibold tabular-nums text-[#EF8046]">{formatUsd(matchedCents)}</span> match</>
          )}
        </p>
      </Fieldset>

      {/* Name */}
      <Fieldset label="Full Name" required>
        <Input name="fullName" value={form.fullName} onChange={onChange} autoComplete="name" placeholder="Your full name" />
      </Fieldset>

      <Fieldset
        label="Name to be displayed"
        hint={<span className="tabular-nums">{displayNameLeft} characters left</span>}
      >
        <Input
          name="displayName"
          value={form.displayName}
          onChange={onChange}
          maxLength={MAX_DISPLAY_NAME}
          placeholder="e.g. The Cohen Family"
        />
        {allowAnonymous && (
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              name="isAnonymous"
              checked={form.isAnonymous}
              onChange={onChange}
              className="w-4 h-4 rounded border-gray-300 text-[#EF8046] focus:ring-[#EF8046]"
            />
            <span className="text-sm text-gray-700">Donate anonymously</span>
          </label>
        )}
      </Fieldset>

      {/* Email */}
      <Fieldset label="Email" required>
        <Input name="email" type="email" value={form.email} onChange={onChange} autoComplete="email" placeholder="you@example.com" />
      </Fieldset>

      {/* Phone */}
      <Fieldset label="Phone" hint="Optional">
        <div className="flex gap-2">
          <select
            name="phoneCountry"
            value={form.phoneCountry}
            onChange={onChange}
            className="px-2 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm focus:border-[#EF8046] outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={onChange}
            autoComplete="tel"
            placeholder="(555) 123-4567"
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm focus:border-[#EF8046] outline-none"
          />
        </div>
      </Fieldset>

      {/* Message */}
      <Fieldset
        label="Message or Dedication"
        hint={<span className="tabular-nums">{messageLeft} characters left</span>}
      >
        <textarea
          name="message"
          value={form.message}
          onChange={onChange}
          rows={2}
          maxLength={MAX_MESSAGE}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm resize-none focus:border-[#EF8046] outline-none"
          placeholder="Message or dedication (optional)"
        />
        {allowDedication && (
          <div className="mt-2 border border-gray-200 rounded-xl p-3 bg-gray-50/40">
            <select
              name="dedicationType"
              value={form.dedicationType}
              onChange={onChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm mb-2"
            >
              <option value="">No formal dedication</option>
              <option value="honor">In honor of</option>
              <option value="memory">In memory of</option>
            </select>
            {form.dedicationType && (
              <div className="space-y-2">
                <input
                  name="dedicationName"
                  value={form.dedicationName}
                  onChange={onChange}
                  placeholder="Name of honoree"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                />
                <input
                  name="dedicationEmail"
                  value={form.dedicationEmail}
                  onChange={onChange}
                  placeholder="Honoree's email (we'll notify them)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                />
              </div>
            )}
          </div>
        )}
      </Fieldset>

      {/* Team */}
      {teams.length > 0 && (
        <Fieldset label="I would like to donate to the following individual or team" hint="Optional">
          <select
            value={teamId ?? ""}
            onChange={(e) => onPickTeam(e.target.value || null)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] outline-none text-sm"
          >
            <option value="">Select team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Fieldset>
      )}

    </div>
  );
}

// ======================== STEP 2: PAYMENT ========================

function PaymentStep({
  paymentMethod, setPaymentMethod, form, onChange, setForm,
  formatCardNumber, formatExpiry, cardNumberRef, cardExpiryRef, cardCvvRef,
  amountCents, matchedCents, totalCents, isRecurring, orgName,
}: {
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  form: DonateForm;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  setForm: React.Dispatch<React.SetStateAction<DonateForm>>;
  formatCardNumber: (v: string) => string;
  formatExpiry: (v: string, prev: string) => string;
  cardNumberRef: React.RefObject<HTMLInputElement | null>;
  cardExpiryRef: React.RefObject<HTMLInputElement | null>;
  cardCvvRef: React.RefObject<HTMLInputElement | null>;
  amountCents: number;
  matchedCents: number;
  totalCents: number;
  isRecurring: boolean;
  orgName: string;
}) {
  const isCharge = paymentMethod === "card" || paymentMethod === "donors_fund" || paymentMethod === "ojc_fund";
  type TileKind =
    | { kind: "icon"; icon: React.ElementType }
    | { kind: "logo"; src: string; alt: string; heightClass?: string }
    | { kind: "badge"; text: string };

  const MethodTile = ({
    m, label, subtitle, visual,
  }: {
    m: PaymentMethod;
    label: string;
    subtitle: string;
    visual: TileKind;
  }) => {
    const active = paymentMethod === m;
    return (
      <button
        type="button"
        onClick={() => setPaymentMethod(m)}
        className={`relative p-3 pt-7 rounded-xl border transition-all text-center flex flex-col items-center justify-start gap-1.5 min-h-[128px] ${
          active
            ? "border-[#EF8046] bg-[#fff5f0] shadow-sm"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
        aria-pressed={active}
      >
        <span
          className={`absolute top-2.5 left-2.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            active ? "border-[#EF8046] bg-[#EF8046]" : "border-gray-300 bg-white"
          }`}
        >
          {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
        </span>

        <div className="h-8 flex items-center justify-center">
          {visual.kind === "icon" ? (
            <visual.icon className="w-7 h-7 text-gray-700" strokeWidth={1.75} />
          ) : visual.kind === "badge" ? (
            <div className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-extrabold tracking-[0.15em]">
              {visual.text}
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={visual.src}
              alt={visual.alt}
              className={`object-contain ${visual.heightClass ?? "h-7"} max-w-[110px]`}
            />
          )}
        </div>

        <div className="text-sm font-semibold text-gray-900 leading-tight">{label}</div>
        <div className="text-[11px] text-gray-500 leading-tight px-1">{subtitle}</div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Payment method</h3>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Lock className="w-3 h-3 text-green-500" /> Secure payment
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <MethodTile
            m="card"
            label="Credit Card"
            subtitle="US tax-deductible receipt"
            visual={{ kind: "icon", icon: CreditCard }}
          />
          <MethodTile
            m="ojc_fund"
            label="OJC Fund"
            subtitle="Charge Charity Card instantly"
            visual={{ kind: "logo", src: "/logos/ojc-fund.png", alt: "OJC Fund", heightClass: "h-8" }}
          />
          <MethodTile
            m="donors_fund"
            label="The Donors Fund"
            subtitle="Charge Giving Card instantly"
            visual={{ kind: "logo", src: "/logos/donors-fund.svg", alt: "The Donors' Fund", heightClass: "h-8" }}
          />
        </div>
      </div>

      <OrgBadge />

      {paymentMethod === "card" && (
        <div className="space-y-3">
          <Fieldset label="Card Number" required>
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
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] outline-none text-sm tabular-nums tracking-wide pr-10"
                placeholder="1234 5678 9012 3456"
              />
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            </div>
          </Fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Fieldset label="Expiry" required>
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
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] outline-none text-sm tabular-nums"
                placeholder="MM / YY"
              />
            </Fieldset>
            <Fieldset label="CVV" required>
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
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] outline-none text-sm tabular-nums"
                placeholder="CVV"
              />
            </Fieldset>
          </div>

          <Fieldset label="Name on card" hint="Leave blank to use your full name">
            <Input name="cardName" value={form.cardName} onChange={onChange} autoComplete="cc-name" placeholder="As it appears on card" />
          </Fieldset>

          <div className="pt-2">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Billing address</div>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Country</label>
                <select
                  name="addrCountry"
                  value={form.addrCountry}
                  onChange={onChange}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm focus:border-[#EF8046] outline-none"
                >
                  <option>United States</option>
                  <option>Israel</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                  <option>Australia</option>
                  <option>Other</option>
                </select>
              </div>

              <AddressAutocomplete
                value={form.addrLine1}
                onChange={(v) => setForm((p) => ({ ...p, addrLine1: v }))}
                onPick={(s) =>
                  setForm((p) => ({
                    ...p,
                    addrLine1: s.line1 || s.label,
                    addrCity: s.city || p.addrCity,
                    addrState: s.state || p.addrState,
                    addrZip: s.zip || p.addrZip,
                    addrCountry: s.country || p.addrCountry,
                  }))
                }
              />

              <Input name="addrApt" value={form.addrApt} onChange={onChange} autoComplete="address-line2" placeholder="Apt. / Suite (optional)" />
              <div className="grid grid-cols-2 gap-2.5">
                <Input name="addrZip" value={form.addrZip} onChange={onChange} autoComplete="postal-code" placeholder="Zip / Post Code" />
                <Input name="addrCity" value={form.addrCity} onChange={onChange} autoComplete="address-level2" placeholder="City" />
              </div>
              <Input name="addrState" value={form.addrState} onChange={onChange} autoComplete="address-level1" placeholder="State / Province / Region (optional)" />
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

      {paymentMethod === "ojc_fund" && (
        <div className="bg-[#FAFAFA] rounded-2xl p-4 space-y-3 border border-gray-100">
          <p className="text-xs text-gray-600 leading-relaxed">
            Enter your OJC Charity Card — we&apos;ll charge it instantly and email your tax-deductible receipt.
          </p>
          <Input
            label="OJC Charity Card Number"
            name="ojcCardNumber"
            value={form.ojcCardNumber}
            onChange={onChange}
            placeholder="6900 0000 0000 0000"
            autoComplete="off"
            inputMode="numeric"
          />
          <Input
            label="Expiration (MMYY)"
            name="ojcExpDate"
            value={form.ojcExpDate}
            onChange={onChange}
            placeholder="1226"
            autoComplete="off"
            inputMode="numeric"
            maxLength={4}
          />
        </div>
      )}

      {/* Confirmation panel */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white px-4 py-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-gray-500">Confirm your donation</div>
          {isRecurring && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fff5f0] border border-[#EF8046]/30 text-[10px] font-bold tracking-wide text-[#EF8046] uppercase">
              Monthly
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-gray-600">
            {isRecurring ? "You donate each month" : "You donate"}
          </span>
          <span className="font-bold text-gray-900 tabular-nums">
            {formatUsd(amountCents)}{isRecurring ? "/mo" : ""}
          </span>
        </div>
        {matchedCents > 0 && (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gray-600">+ Match</span>
            <span className="font-bold tabular-nums text-[#EF8046]">{formatUsd(matchedCents)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between text-sm pt-2 border-t border-gray-100">
          <span className="font-semibold text-gray-700">{orgName} receives{isRecurring ? " today" : ""}</span>
          <span className="font-extrabold text-gray-900 tabular-nums">{formatUsd(totalCents)}</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
          {isCharge
            ? isRecurring
              ? <>You will be <span className="font-semibold text-gray-700">charged {formatUsd(amountCents)} today</span>, then the same amount on this day every month until you cancel. A tax-deductible receipt will be emailed after each charge.</>
              : <>You will be <span className="font-semibold text-gray-700">charged now</span>. A tax-deductible receipt will be emailed to you.</>
            : <>Your pledge is recorded immediately. We&apos;ll email you next steps to complete the grant.</>}
        </p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          By clicking Donate, you confirm that you accept our{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline text-[#EF8046]">terms &amp; conditions</a>
          {" "}and acknowledge our{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline text-[#EF8046]">privacy policy</a>.
        </p>
      </div>
    </div>
  );
}

// ======================== SUCCESS ========================

function SuccessStep({
  amountCents, isPledge, isRecurring, email, onClose,
}: { amountCents: number; isPledge: boolean; isRecurring: boolean; email: string; onClose: () => void }) {
  // Fire confetti once when the success step appears. Skip for pledges (no charge)
  // and for users who prefer reduced motion.
  useEffect(() => {
    if (isPledge) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#EF8046", "#d96a2f", "#ffd86b", "#ffffff"];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.55 }, colors, scalar: 0.95 });
    const t1 = window.setTimeout(
      () => confetti({ particleCount: 70, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors }),
      220,
    );
    const t2 = window.setTimeout(
      () => confetti({ particleCount: 70, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors }),
      340,
    );
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [isPledge]);

  return (
    <div className="py-2">
      <div className="text-center">
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
        <p className="text-gray-600 text-sm">
          {isRecurring
            ? <>Your <span className="font-semibold text-gray-900">{formatUsd(amountCents)}/month</span> donation has been set up. You&apos;ll be charged the same amount on this day every month until you cancel.</>
            : <>Your {formatUsd(amountCents)} {isPledge ? "pledge" : "donation"} has been {isPledge ? "recorded" : "processed"}.</>}
        </p>
        {email && (
          <p className="text-sm text-gray-500 mt-1">
            A confirmation email will be sent to{" "}
            <span className="font-semibold text-gray-700">{email}</span>.
          </p>
        )}
      </div>

      {/* Increase your impact */}
      <div className="mt-6 rounded-2xl border-2 border-[#EF8046]/30 bg-gradient-to-br from-[#fff5f0] to-[#fef7e6] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#EF8046] text-white text-xs font-bold">
            3×
          </span>
          <h4 className="text-sm font-bold text-gray-900">Increase your impact up to 300%</h4>
        </div>
        <p className="text-xs text-gray-700 leading-relaxed mb-3">
          Thanks to matching sponsors, your gift can be multiplied. Pick an option below to deepen its effect:
        </p>
        <div className="space-y-2">
          <ImpactLink
            label="Share with a friend"
            sub="One share can 3× your gift's reach"
            href={typeof window !== "undefined" ? `https://api.whatsapp.com/send?text=${encodeURIComponent(`I just gave to JRE. Join me: ${window.location.href}`)}` : "#"}
          />
          {!isRecurring && (
            <ImpactLink
              label="Make it monthly"
              sub="Contact us to set up a recurring gift"
              href="mailto:office@thejre.org?subject=Set%20up%20recurring%20gift"
            />
          )}
          <ImpactLink
            label="Ask your employer to match"
            sub="Many companies double charitable gifts"
            href="mailto:office@thejre.org?subject=Employer%20match"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
      >
        Return to campaign
      </button>
    </div>
  );
}

function ImpactLink({ label, sub, href }: { label: string; sub: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 hover:bg-white hover:border-[#EF8046] transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-tight">{label}</div>
          <div className="text-[11px] text-gray-600 leading-tight mt-0.5">{sub}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#EF8046] flex-shrink-0" />
      </div>
    </a>
  );
}

// ======================== SHARED ATOMS ========================

function OrgBadge() {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-[11px] text-gray-600 leading-relaxed space-y-0.5">
      <div><span className="font-semibold text-gray-700">Organization Legal Name:</span> Jewish Renaissance Experience Inc.</div>
      <div><span className="font-semibold text-gray-700">Bank Statement:</span> JRE THEJRE.ORG</div>
      <div><span className="font-semibold text-gray-700">Tax ID:</span> 45-3421900</div>
      <div className="text-gray-500">This organization is a US registered 501(c)(3) non-profit.</div>
    </div>
  );
}

function Fieldset({
  label, hint, required, children,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}{required && <span className="text-[#EF8046] ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

interface AddrSuggestion {
  label: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

function AddressAutocomplete({
  value, onChange, onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: AddrSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddrSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounce the query — 150ms after last keystroke for a snappy feel.
  // Abort any in-flight request when the user keeps typing so we never
  // render stale suggestions over a newer query.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions((data.suggestions as AddrSuggestion[]) ?? []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 150);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (s: AddrSuggestion) => {
    onPick(s);
    setOpen(false);
    setSuggestions([]);
    setHighlighted(-1);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(suggestions.length - 1, h + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(0, h - 1)); }
          else if (e.key === "Enter" && highlighted >= 0) { e.preventDefault(); pick(suggestions[highlighted]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        autoComplete="off"
        placeholder="Start typing your address…"
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] outline-none text-sm"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-64 overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-gray-400">Searching…</div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className={`block w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 ${
                highlighted === i ? "bg-[#fff5f0]" : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="font-medium text-gray-900 leading-tight truncate">
                {s.line1 || s.label.split(",")[0]}
              </div>
              <div className="text-[11px] text-gray-500 leading-tight truncate mt-0.5">
                {[s.city, s.state, s.zip, s.country].filter(Boolean).join(", ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({
  label, name, value, onChange, type = "text", placeholder, autoComplete, maxLength, inputMode,
}: {
  label?: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const input = (
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      maxLength={maxLength}
      inputMode={inputMode}
      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] outline-none text-sm transition-all"
    />
  );
  if (!label) return input;
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
        {label}
      </label>
      {input}
    </div>
  );
}
