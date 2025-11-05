// API route to send SMS responses back
import twilio from "twilio";

export const runtime = "nodejs";

// Initialize Twilio client with API Key authentication
let twilioClient: twilio.Twilio | null = null;
function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      throw new Error(
        "Missing Twilio credentials. Required: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET"
      );
    }

    // Use API Key authentication (more secure than Auth Token)
    twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  return twilioClient;
}

export async function POST(request: Request) {
  try {
    const { to, message } = await request.json();

    console.log("[send-sms] Sending SMS:", {
      to,
      message: message.substring(0, 100)
    });

    // Send SMS via Twilio
    const client = getTwilioClient();
    const result = await client.messages.create({
      body: message,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    console.log("[send-sms] ✅ SMS sent successfully, SID:", result.sid);

    return Response.json({
      success: true,
      messageSid: result.sid
    });
  } catch (error) {
    console.error("[send-sms] ❌ Error sending SMS:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send SMS"
      },
      { status: 500 }
    );
  }
}
