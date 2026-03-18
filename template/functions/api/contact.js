/**
 * Cloudflare Pages Function — Contact Form Handler
 * 
 * Receives POST requests from the contact form and sends an email
 * notification via Resend (free tier: 100 emails/day).
 * 
 * Environment variables required (set in CF Pages dashboard):
 *   RESEND_API_KEY   — Get from https://resend.com/api-keys
 *   CONTACT_EMAIL    — The client's email to receive form submissions
 *   FROM_EMAIL       — e.g., "noreply@clientdomain.com" (must verify domain in Resend)
 * 
 * To use Resend's free tier without domain verification:
 *   Set FROM_EMAIL to "onboarding@resend.dev" (Resend's sandbox sender)
 *   This works for testing/staging. Verify client domain for production.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const body = await request.json();
    const { name, email, phone, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Name, email, and message are required." }),
        { status: 400, headers }
      );
    }

    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address." }),
        { status: 400, headers }
      );
    }

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "onboarding@resend.dev",
        to: [env.CONTACT_EMAIL],
        subject: `New Contact Form Submission from ${name}`,
        reply_to: email,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
          <hr />
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
          <hr />
          <p style="color: #888; font-size: 12px;">
            Sent via website contact form at ${new Date().toISOString()}
          </p>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errData = await resendResponse.json().catch(() => ({}));
      console.error("Resend API error:", errData);
      return new Response(
        JSON.stringify({ error: "Failed to send message. Please try again." }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully." }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error("Contact form error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers }
    );
  }
}

// Prevent XSS in email body
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
