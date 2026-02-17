"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CreditCard, Lock } from "lucide-react";

interface BanquestDirectPaymentProps {
  onCardDataReady: (cardData: BanquestCardData) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
}

export interface BanquestCardData {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}

// Create a global store for the card data getter
declare global {
  interface Window {
    getBanquestCardData?: () => BanquestCardData | null;
  }
}

export function useBanquestDirectPayment() {
  const getCardData = useCallback((): BanquestCardData | null => {
    if (typeof window !== "undefined" && window.getBanquestCardData) {
      return window.getBanquestCardData();
    }
    return null;
  }, []);

  return { getCardData };
}

// Card brand detection
function getCardBrand(number: string): { name: string; maxLength: number; cvvLength: number } | null {
  const digits = number.replace(/\s/g, "");
  if (/^4/.test(digits)) return { name: "visa", maxLength: 16, cvvLength: 3 };
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return { name: "mastercard", maxLength: 16, cvvLength: 3 };
  if (/^3[47]/.test(digits)) return { name: "amex", maxLength: 15, cvvLength: 4 };
  if (/^6(?:011|5)/.test(digits)) return { name: "discover", maxLength: 16, cvvLength: 3 };
  return null;
}

// Card brand display component
function CardBrandIcon({ brand }: { brand: string | null }) {
  if (!brand) return <CreditCard className="w-5 h-5 text-gray-300" />;

  const brandStyles: Record<string, { text: string; bg: string; label: string }> = {
    visa: { text: "text-white", bg: "bg-[#1A1F71]", label: "VISA" },
    mastercard: { text: "text-white", bg: "bg-[#EB001B]", label: "MC" },
    amex: { text: "text-white", bg: "bg-[#006FCF]", label: "AMEX" },
    discover: { text: "text-white", bg: "bg-[#FF6000]", label: "DISC" },
  };

  const style = brandStyles[brand];
  if (!style) return <CreditCard className="w-5 h-5 text-gray-300" />;

  return (
    <span className={`${style.bg} ${style.text} text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide`}>
      {style.label}
    </span>
  );
}

export default function BanquestDirectPayment({
  onCardDataReady,
  onValidationChange,
  disabled = false,
}: BanquestDirectPaymentProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);

  const brand = getCardBrand(cardNumber);

  // Format card number with spaces every 4 digits (Amex: 4-6-5)
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (brand?.name === "amex") {
      const parts = [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)];
      return parts.filter(Boolean).join(" ");
    }
    const groups = digits.match(/.{1,4}/g);
    return groups ? groups.join(" ") : digits;
  };

  // Validation
  const cardDigits = cardNumber.replace(/\s/g, "");
  const cardError = touched.card && cardDigits.length > 0 && cardDigits.length < 13 ? "Card number is too short" : null;
  const monthNum = parseInt(expiryMonth);
  const monthError = touched.month && expiryMonth && (isNaN(monthNum) || monthNum < 1 || monthNum > 12) ? "Invalid month" : null;
  const yearNum = parseInt(expiryYear);
  const yearError = touched.year && expiryYear.length === 2 && (isNaN(yearNum) || yearNum < 24 || yearNum > 40) ? "Invalid year" : null;
  const cvvError = touched.cvv && cvv && cvv.length < 3 ? "Too short" : null;

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const maxLen = brand?.maxLength || 16;
    const trimmed = raw.slice(0, maxLen);
    setCardNumber(formatCardNumber(trimmed));

    if (trimmed.length >= maxLen) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 2);
    setExpiryMonth(value);
    if (value.length === 2) {
      yearRef.current?.focus();
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 2);
    setExpiryYear(value);
    if (value.length === 2) {
      cvvRef.current?.focus();
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxLen = brand?.cvvLength || 4;
    setCvv(e.target.value.replace(/\D/g, "").slice(0, maxLen));
  };

  // Validate all fields
  useEffect(() => {
    const digits = cardNumber.replace(/\s/g, "");
    const month = parseInt(expiryMonth);
    const year = parseInt(expiryYear);

    const cardValid = digits.length >= 13 && digits.length <= 19;
    const monthValid = month >= 1 && month <= 12;
    const yearValid = year >= 24 && year <= 40;
    const cvvValid = cvv.length >= 3 && cvv.length <= 4;

    const allValid = cardValid && monthValid && yearValid && cvvValid;
    setIsValid(allValid);
    onValidationChange?.(allValid);

    if (typeof window !== "undefined") {
      window.getBanquestCardData = () => {
        if (!allValid) return null;
        return {
          cardNumber: digits,
          expiryMonth: month,
          expiryYear: year < 100 ? year + 2000 : year,
          cvv,
        };
      };
    }

    if (allValid) {
      onCardDataReady({
        cardNumber: digits,
        expiryMonth: month,
        expiryYear: year < 100 ? year + 2000 : year,
        cvv,
      });
    }
  }, [cardNumber, expiryMonth, expiryYear, cvv, onCardDataReady, onValidationChange]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        delete window.getBanquestCardData;
      }
    };
  }, []);

  const isFocusedOnAny = focused !== null;

  return (
    <div className={`space-y-3 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Unified card input container */}
      <div
        className={`rounded-xl border-2 bg-white overflow-hidden transition-all duration-200 ${
          isFocusedOnAny
            ? "border-[#EF8046] shadow-[0_0_0_3px_rgba(239,128,70,0.12)]"
            : cardError || monthError || yearError || cvvError
            ? "border-red-300"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {/* Card Number Row */}
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={handleCardChange}
            onFocus={() => setFocused("card")}
            onBlur={() => { setFocused(null); setTouched(t => ({ ...t, card: true })); }}
            className="w-full px-4 py-3.5 text-[15px] text-gray-900 placeholder-gray-400 bg-transparent outline-none pr-16"
            placeholder="Card number"
            maxLength={brand?.name === "amex" ? 17 : 23}
            disabled={disabled}
            autoComplete="cc-number"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <CardBrandIcon brand={brand?.name || null} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Expiry + CVV Row */}
        <div className="flex">
          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            value={expiryMonth}
            onChange={handleMonthChange}
            onFocus={() => setFocused("month")}
            onBlur={() => { setFocused(null); setTouched(t => ({ ...t, month: true })); }}
            className="w-16 px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-transparent outline-none text-center"
            placeholder="MM"
            maxLength={2}
            disabled={disabled}
            autoComplete="cc-exp-month"
          />
          <span className="text-gray-300 self-center text-sm">/</span>
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            value={expiryYear}
            onChange={handleYearChange}
            onFocus={() => setFocused("year")}
            onBlur={() => { setFocused(null); setTouched(t => ({ ...t, year: true })); }}
            className="w-14 px-2 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-transparent outline-none text-center"
            placeholder="YY"
            maxLength={2}
            disabled={disabled}
            autoComplete="cc-exp-year"
          />

          {/* Vertical divider */}
          <div className="border-l border-gray-100 my-2" />

          <input
            ref={cvvRef}
            type="text"
            inputMode="numeric"
            value={cvv}
            onChange={handleCvvChange}
            onFocus={() => setFocused("cvv")}
            onBlur={() => { setFocused(null); setTouched(t => ({ ...t, cvv: true })); }}
            className="flex-1 px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 bg-transparent outline-none"
            placeholder="CVV"
            maxLength={brand?.cvvLength || 4}
            disabled={disabled}
            autoComplete="cc-csc"
          />
        </div>
      </div>

      {/* Validation errors */}
      {(cardError || monthError || yearError || cvvError) && (
        <p className="text-xs text-red-500 px-1">
          {cardError || monthError || yearError || cvvError}
        </p>
      )}

      {/* Security badge */}
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        <Lock className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        <span>256-bit encrypted. Your card details are secure.</span>
        {isValid && (
          <span className="ml-auto text-green-600 font-medium">Ready</span>
        )}
      </div>
    </div>
  );
}
