// Send form link email to proctor
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { proctorId } = await req.json()

    if (!proctorId) {
      throw new Error('proctorId is required')
    }

    // Get proctor details
    const { data: proctor, error: fetchError } = await supabaseClient
      .from('proctors')
      .select('*')
      .eq('id', proctorId)
      .single()

    if (fetchError || !proctor) {
      throw new Error('Proctor not found')
    }

    if (!proctor.email) {
      throw new Error('Proctor email not found')
    }

    // Generate token if not exists
    const token = proctor.form_link_token || crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14) // 14 days expiration

    // Update proctor with token and sent timestamp
    const { error: updateError } = await supabaseClient
      .from('proctors')
      .update({
        form_link_token: token,
        form_status: 'shared',
        form_link_sent_at: new Date().toISOString(),
        form_link_expires_at: expiresAt.toISOString(),
        form_shared_at: new Date().toISOString(),
        upd: new Date().toISOString(),
      })
      .eq('id', proctorId)

    if (updateError) {
      throw updateError
    }

    // Construct form link
    const baseUrl = (
      Deno.env.get('PUBLIC_SITE_URL') ||
      req.headers.get('origin') ||
      'http://localhost:3000'
    ).replace(/\/$/, '')
    const formUrl = `${baseUrl}/onboarding-form?token=${token}`

    const recipientName = proctor.name || 'there'

    // Email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: #ffffff; color: #1f2937; font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .header { padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
    .header h1 { margin: 0; font-size: 20px; color: #111827; }
    .content { padding: 24px; line-height: 1.6; font-size: 15px; }
    .button { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .link { word-break: break-all; color: #2563eb; }
    .footer { padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .meta { margin-top: 16px; font-size: 13px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Talview Proctor Pre-Onboarding</h1>
      </div>
      <div class="content">
        <p>Hello ${recipientName},</p>
        <p>Please complete your pre-onboarding form using the secure link below.</p>
        <p>
          <a href="${formUrl}" class="button" target="_blank" rel="noopener noreferrer">Open Pre-Onboarding Form</a>
        </p>
        <p class="meta">
          If the button does not work, use this link:
        </p>
        <p>
          <a href="${formUrl}" class="link" target="_blank" rel="noopener noreferrer">${formUrl}</a>
        </p>
        <p class="meta">
          This link expires in 14 days and can be used once. An OTP will be sent to this email address when the form is opened.
        </p>
        <p class="meta">
          If you need help, contact your coordinator.
        </p>
      </div>
      <div class="footer">
        Sent automatically by Talview Proctor Portal.
      </div>
    </div>
  </div>
</body>
</html>
    `

    // Send via Mailgun API directly
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN')
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY')
    
    if (!mailgunDomain || !mailgunApiKey) {
      throw new Error('Mailgun credentials not configured')
    }

    const formData = new FormData()
    formData.append('from', `Talview Proctor Portal <noreply@${mailgunDomain}>`)
    formData.append('to', proctor.email)
    formData.append('subject', 'Action required: complete your Talview pre-onboarding form')
    formData.append('html', emailHtml)
    formData.append('text', `Hello,

Please complete your pre-onboarding form using the secure link below:
${formUrl}

If the button does not work, copy and paste the link into your browser.

This link expires in 14 days and can be used once. An OTP will be sent to this email when you open the form.

If you have any questions, please contact your coordinator.

Sent automatically by Talview Proctor Portal.`)

    formData.append('o:tracking-opens', 'no')
    formData.append('o:tracking-clicks', 'no')

    const replyTo = Deno.env.get('MAILGUN_REPLY_TO')
    if (replyTo) {
      formData.append('h:Reply-To', replyTo)
    }

    const mailgunResponse = await fetch(
      `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
        },
        body: formData,
      }
    )

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text()
      console.error('Mailgun error:', errorText)
      throw new Error(`Mailgun failed: ${errorText}`)
    }

    const mailgunResult = await mailgunResponse.json()
    console.log('Mailgun success:', mailgunResult)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Form link sent successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
