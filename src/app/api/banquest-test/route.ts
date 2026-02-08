import { NextResponse } from "next/server";
import { processPayment, processDirectCardPayment } from "@/lib/banquest";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentToken, cardNumber, expiryMonth, expiryYear, cvv, amount, name, email } = body;

    console.log("=== BANQUEST TEST PAYMENT ===");
    console.log("Amount:", amount);
    console.log("Name:", name);
    console.log("Email:", email);
    console.log("Mode:", cardNumber ? "Direct Card" : "Tokenized");

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    let result;

    // Check if using direct card input or tokenized
    if (cardNumber) {
      // Direct card payment (bypasses tokenization)
      console.log("Processing direct card payment...");
      console.log("Card:", cardNumber.substring(0, 6) + "..." + cardNumber.slice(-4));

      result = await processDirectCardPayment({
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
        amount: parseFloat(amount),
        cardName: name,
        email,
        description: "Banquest API Test Payment (Direct)",
      });
    } else if (paymentToken) {
      // Tokenized payment
      console.log("Processing tokenized payment...");
      console.log("Token:", paymentToken.substring(0, 20) + "...");

      result = await processPayment({
        paymentToken,
        amount: parseFloat(amount),
        cardName: name,
        email,
        description: "Banquest API Test Payment (Tokenized)",
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Either payment token or card details are required" },
        { status: 400 }
      );
    }

    console.log("Payment result:", result);

    if (result.success) {
      return NextResponse.json({
        success: true,
        transactionId: result.transactionId,
        authCode: result.authCode,
        responseText: result.responseText,
        message: "Payment processed successfully",
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Payment failed",
      });
    }
  } catch (error) {
    console.error("Banquest test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
