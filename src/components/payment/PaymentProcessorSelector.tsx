"use client";

interface PaymentProcessorSelectorProps {
  selected: "square" | "banquest";
  onChange: (processor: "square" | "banquest") => void;
  disabled?: boolean;
}

export default function PaymentProcessorSelector({
  selected,
  onChange,
  disabled = false,
}: PaymentProcessorSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Payment Processor (Testing)
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("square")}
          disabled={disabled}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border-2 ${
            selected === "square"
              ? "bg-[#EF8046] text-white border-[#EF8046]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#EF8046] hover:text-[#EF8046]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Square
        </button>
        <button
          type="button"
          onClick={() => onChange("banquest")}
          disabled={disabled}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border-2 ${
            selected === "banquest"
              ? "bg-[#EF8046] text-white border-[#EF8046]"
              : "bg-white text-gray-600 border-gray-200 hover:border-[#EF8046] hover:text-[#EF8046]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Banquest
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        For testing - both processors are active
      </p>
    </div>
  );
}
