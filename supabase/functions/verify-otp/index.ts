// Verify OTP and grant access to form
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

    const { token, otp } = await req.json()

    if (!token || !otp) {
      throw new Error('Token and OTP are required')
    }

    // Find proctor by token
    const { data: proctor, error: fetchError } = await supabaseClient
      .from('proctors')
      .select('*')
      .eq('form_link_token', token)
      .single()

    if (fetchError || !proctor) {
      throw new Error('Invalid token')
    }

    // Check if OTP exists
    if (!proctor.form_otp) {
      throw new Error('No OTP found. Please request a new one.')
    }

    // Check if OTP has expired
    if (proctor.form_otp_expires_at) {
      const expiresAt = new Date(proctor.form_otp_expires_at)
      if (expiresAt < new Date()) {
        throw new Error('OTP has expired. Please request a new one.')
      }
    }

    // Check attempt limit (max 5 attempts)
    if (proctor.form_otp_attempts >= 5) {
      throw new Error('Too many failed attempts. Please request a new OTP.')
    }

    // Verify OTP
    if (proctor.form_otp !== otp.trim()) {
      // Increment failed attempts
      await supabaseClient
        .from('proctors')
        .update({
          form_otp_attempts: (proctor.form_otp_attempts || 0) + 1,
          upd: new Date().toISOString(),
        })
        .eq('id', proctor.id)

      throw new Error('Invalid OTP. Please try again.')
    }

    // OTP is valid - clear it and return proctor data
    const { error: updateError } = await supabaseClient
      .from('proctors')
      .update({
        form_otp: null, // Clear OTP after successful verification
        form_otp_expires_at: null,
        form_otp_attempts: 0,
        upd: new Date().toISOString(),
      })
      .eq('id', proctor.id)

    if (updateError) {
      throw updateError
    }

    // Return proctor data for pre-filling the form
    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP verified successfully',
        proctor: {
          id: proctor.id,
          email: proctor.email,
          name: proctor.name || '',
          phone: proctor.phone && !proctor.phone.startsWith('PENDING_') ? proctor.phone : '',
          aadhaar: proctor.aadhaar && !proctor.aadhaar.startsWith('PENDING_') ? proctor.aadhaar : '',
          address: proctor.address || '',
          city: proctor.city || '',
          state: proctor.state || '',
          dob: proctor.dob || '',
          gender: proctor.gender || '',
          managed_by: proctor.managed_by,
          ptype: proctor.ptype,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
