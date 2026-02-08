import { NextResponse } from "next/server";

export async function GET() {
  const sourceKey = process.env.BANQUEST_SOURCE_KEY;
  const pin = process.env.BANQUEST_PIN;

  return NextResponse.json({
    sourceKeyExists: !!sourceKey,
    sourceKeyLength: sourceKey?.length || 0,
    sourceKeyFirst4: sourceKey?.substring(0, 4) || "N/A",
    pinExists: !!pin,
    pinLength: pin?.length || 0,
    nodeEnv: process.env.NODE_ENV,
  });
}
