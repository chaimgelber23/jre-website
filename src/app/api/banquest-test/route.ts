import { NextResponse } from "next/server";
import { processPayment } from "@/lib/banquest";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentToken, amount, name, email } = body;

    console.log("=== BANQUEST TEST PAYMENT ===");
    console.log("Amount:", amount);
    console.log("Name:", name);
    console.log("Email:", email);
    console.log("Token:", paymentToken ? paymentToken.substring(0, 20) + "..." : "MISSING");

    // Validate required fields
    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 }
      );
    }

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

    // Process the payment using the new Banquest JSON API
    const result = await processPayment({
      paymentToken,
      amount: parseFloat(amount),
      cardName: name,
      email,
      description: "Banquest API Test Payment",
    });

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
