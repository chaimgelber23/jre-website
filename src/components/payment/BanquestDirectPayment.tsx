"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CreditCard, Lock, AlertCircle } from "lucide-react";

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

  // Refs for auto-focus
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const groups = digits.match(/.{1,4}/g);
    return groups ? groups.join(" ") : digits;
  };

  // Detect card type based on number
  const getCardType = (number: string) => {
    const digits = number.replace(/\s/g, "");
    if (/^4/.test(digits)) return "visa";
    if (/^5[1-5]/.test(digits)) return "mastercard";
    if (/^3[47]/.test(digits)) return "amex";
    if (/^6(?:011|5)/.test(digits)) return "discover";
    return null;
  };

  const cardType = getCardType(cardNumber);

  // Validation helpers
  const validateMonth = (value: string) => {
    if (!value) return null;
    const month = parseInt(value);
    if (isNaN(month)) return "Invalid";
    if (month < 1 || month > 12) return "1-12";
    return null;
  };

  const validateYear = (value: string) => {
    if (!value) return null;
    if (value.length > 0 && value.length < 4) return "Use 4 digits";
    const year = parseInt(value);
    if (isNaN(year)) return "Invalid";
    if (year < 2024 || year > 2040) return "Invalid year";
    return null;
  };

  const validateCvv = (value: string) => {
    if (!value) return null;
    if (value.length < 3) return "3-4 digits";
    return null;
  };

  const validateCard = (value: string) => {
    const digits = value.replace(/\s/g, "");
    if (!digits) return null;
    if (digits.length < 13) return "Too short";
    if (digits.length > 19) return "Too long";
    return null;
  };

  const monthError = touched.month ? validateMonth(expiryMonth) : null;
  const yearError = touched.year ? validateYear(expiryYear) : null;
  const cvvError = touched.cvv ? validateCvv(cvv) : null;
  const cardError = touched.card ? validateCard(cardNumber) : null;

  // Handle card number input with auto-focus
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);

    // Auto-focus to month when card is complete (16+ digits)
    const digits = formatted.replace(/\s/g, "");
    if (digits.length >= 16) {
      monthRef.current?.focus();
    }
  };

  // Handle month input with auto-focus
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 2);
    setExpiryMonth(value);

    // Auto-focus to year when month is complete
    if (value.length === 2) {
      yearRef.current?.focus();
    }
  };

  // Handle year input with auto-focus
  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setExpiryYear(value);

    // Auto-focus to CVV when year is complete
    if (value.length === 4) {
      cvvRef.current?.focus();
    }
  };

  // Handle CVV input
  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCvv(e.target.value.replace(/\D/g, "").slice(0, 4));
  };

  // Validate all fields
  useEffect(() => {
    const cardDigits = cardNumber.replace(/\s/g, "");
    const month = parseInt(expiryMonth);
    const year = parseInt(expiryYear);

    const cardValid = cardDigits.length >= 13 && cardDigits.length <= 19;
    const monthValid = month >= 1 && month <= 12;
    const yearValid = year >= 2024 && year <= 2040;
    const cvvValid = cvv.length >= 3 && cvv.length <= 4;

    const allValid = cardValid && monthValid && yearValid && cvvValid;
    setIsValid(allValid);
    onValidationChange?.(allValid);

    // Set up global getter for parent components
    if (typeof window !== "undefined") {
      window.getBanquestCardData = () => {
        if (!allValid) return null;
        return {
          cardNumber: cardDigits,
          expiryMonth: month,
          expiryYear: year,
          cvv: cvv,
        };
      };
    }

    // Notify parent when card data is ready
    if (allValid) {
      onCardDataReady({
        cardNumber: cardDigits,
        expiryMonth: month,
        expiryYear: year,
        cvv: cvv,
      });
    }
  }, [cardNumber, expiryMonth, expiryYear, cvv, onCardDataReady, onValidationChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        delete window.getBanquestCardData;
      }
    };
  }, []);

  const inputBaseClass = `w-full px-4 py-3 rounded-lg border bg-white text-gray-900 text-sm transition-all duration-200 outline-none`;
  const getInputClass = (fieldName: string, hasError: boolean) => {
    const isFocused = focused === fieldName;
    return `${inputBaseClass} ${
      hasError
        ? "border-red-400 ring-2 ring-red-100"
        : isFocused
        ? "border-[#EF8046] ring-2 ring-[#EF8046]/20"
        : "border-gray-200 hover:border-gray-300"
    } ${disabled ? "bg-gray-50 cursor-not-allowed opacity-60" : ""}`;
  };

  return (
    <div className="space-y-4">
      {/* Card Number Field */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Card Number
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={handleCardChange}
            onFocus={() => setFocused("cardNumber")}
            onBlur={() => {
              setFocused(null);
              setTouched(t => ({ ...t, card: true }));
            }}
            className={`${getInputClass("cardNumber", !!cardError)} pr-12`}
            maxLength={23}
            disabled={disabled}
            autoComplete="cc-number"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {cardType === "visa" && (
              <span className="text-blue-600 font-bold text-xs">VISA</span>
            )}
            {cardType === "mastercard" && (
              <span className="text-red-500 font-bold text-xs">MC</span>
            )}
            {cardType === "amex" && (
              <span className="text-blue-500 font-bold text-xs">AMEX</span>
            )}
            {cardType === "discover" && (
              <span className="text-orange-500 font-bold text-xs">DISC</span>
            )}
            {!cardType && (
              <CreditCard className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
        {cardError && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {cardError}
          </p>
        )}
      </div>

      {/* Expiry and CVV Row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Month
            <span className="text-gray-400 font-normal ml-1">(MM)</span>
          </label>
          <input
            ref={monthRef}
            type="text"
            inputMode="numeric"
            value={expiryMonth}
            onChange={handleMonthChange}
            onFocus={() => setFocused("month")}
            onBlur={() => {
              setFocused(null);
              setTouched(t => ({ ...t, month: true }));
            }}
            className={getInputClass("month", !!monthError)}
            placeholder="01"
            maxLength={2}
            disabled={disabled}
            autoComplete="cc-exp-month"
          />
          {monthError && (
            <p className="text-xs text-red-500 mt-1">{monthError}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Year
            <span className="text-gray-400 font-normal ml-1">(YYYY)</span>
          </label>
          <input
            ref={yearRef}
            type="text"
            inputMode="numeric"
            value={expiryYear}
            onChange={handleYearChange}
            onFocus={() => setFocused("year")}
            onBlur={() => {
              setFocused(null);
              setTouched(t => ({ ...t, year: true }));
            }}
            className={getInputClass("year", !!yearError)}
            placeholder="2025"
            maxLength={4}
            disabled={disabled}
            autoComplete="cc-exp-year"
          />
          {yearError && (
            <p className="text-xs text-red-500 mt-1">{yearError}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            CVV
            <span className="text-gray-400 font-normal ml-1">(3-4)</span>
          </label>
          <input
            ref={cvvRef}
            type="text"
            inputMode="numeric"
            value={cvv}
            onChange={handleCvvChange}
            onFocus={() => setFocused("cvv")}
            onBlur={() => {
              setFocused(null);
              setTouched(t => ({ ...t, cvv: true }));
            }}
            className={getInputClass("cvv", !!cvvError)}
            placeholder="123"
            maxLength={4}
            disabled={disabled}
            autoComplete="cc-csc"
          />
          {cvvError && (
            <p className="text-xs text-red-500 mt-1">{cvvError}</p>
          )}
        </div>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <Lock className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-400">
          Secured by 256-bit encryption
        </span>
        {isValid && (
          <span className="text-xs text-green-600 font-medium ml-2">
            ✓ Ready
          </span>
        )}
      </div>
    </div>
  );
}
