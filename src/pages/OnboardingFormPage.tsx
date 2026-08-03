import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { supabase } from '@/services/supabase';

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Puducherry', 'Jammu and Kashmir', 'Ladakh',
];

export default function OnboardingFormPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'otp' | 'form' | 'success'>('otp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const otpSentRef = useRef(false);

  // OTP form
  const [otp, setOtp] = useState('');

  // Onboarding form
  const [proctorData, setProctorData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    aadhaar: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    dob: '',
    gender: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing token');
      return;
    }
    if (otpSentRef.current) return; // guard against double-fire in React 18 Strict Mode
    otpSentRef.current = true;
    handleSendOTP();
  }, [token]);

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      setError('');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setMaskedEmail(data.maskedEmail);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      // OTP verified - show form
      setProctorData(data.proctor);
      setFormData({
        name: data.proctor.name || '',
        aadhaar: data.proctor.aadhaar || '',
        phone: data.proctor.phone || '',
        address: data.proctor.address || '',
        city: data.proctor.city || '',
        state: data.proctor.state || '',
        dob: data.proctor.dob || '',
        gender: data.proctor.gender || '',
      });
      setStep('form');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.aadhaar.trim()) {
      errors.aadhaar = 'Aadhaar is required';
    } else if (!/^\d{12}$/.test(formData.aadhaar)) {
      errors.aadhaar = 'Aadhaar must be 12 digits';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone is required';
    } else if (!/^\d{10}$/.test(formData.phone)) {
      errors.phone = 'Phone must be 10 digits';
    }
    if (!formData.address.trim()) errors.address = 'Address is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.state) errors.state = 'State is required';
    if (!formData.dob) errors.dob = 'Date of Birth is required';
    if (!formData.gender) errors.gender = 'Gender is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fix all errors before submitting');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Update proctor record
      const { error: updateError } = await supabase
        .from('proctors')
        .update({
          name: formData.name.trim(),
          aadhaar: formData.aadhaar.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state,
          dob: formData.dob,
          gender: formData.gender,
          form_status: 'submitted',
          status: 'In Progress',
          stage: 1,
          upd: new Date().toISOString(),
        })
        .eq('id', proctorData.id);

      if (updateError) throw updateError;

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-text mb-2">Invalid Link</h1>
          <p className="text-text2 text-sm">
            This onboarding link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-accent5 p-8 text-center">
          <div className="text-4xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Talview Proctor Onboarding
          </h1>
          <p className="text-white/80 text-sm">
            {step === 'otp' && 'Verify your email to continue'}
            {step === 'form' && 'Complete your profile'}
            {step === 'success' && 'Registration complete'}
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-6 text-danger text-sm">
              {error}
            </div>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP}>
              {otpSent ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-4">📧</div>
                    <h2 className="text-lg font-semibold text-text mb-2">
                      OTP Sent!
                    </h2>
                    <p className="text-text2 text-sm mb-1">
                      We've sent a 6-digit code to:
                    </p>
                    <p className="text-accent font-mono font-bold">
                      {maskedEmail}
                    </p>
                    <p className="text-text3 text-xs mt-2">
                      Valid for 10 minutes
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-text mb-2">
                      Enter OTP
                    </label>
                    <Input
                      type="text"
                      value={otp}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtp(value);
                      }}
                      placeholder="000000"
                      maxLength={6}
                      className="text-center text-2xl font-mono font-bold tracking-widest"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      className="flex-1"
                      disabled={loading || otp.length !== 6}
                    >
                      {loading ? 'Verifying...' : '✅ Verify OTP'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleSendOTP}
                      disabled={loading}
                    >
                      🔄 Resend
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">⏳</div>
                  <p className="text-text2">Sending OTP to your email...</p>
                </div>
              )}
            </form>
          )}

          {/* Form Step */}
          {step === 'form' && (
            <form onSubmit={handleSubmitForm}>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Full Name <span className="text-danger">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                  {formErrors.name && (
                    <div className="text-danger text-xs mt-1">{formErrors.name}</div>
                  )}
                </div>

                {/* Aadhaar & Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Aadhaar Number <span className="text-danger">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.aadhaar}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setFormData({ ...formData, aadhaar: value });
                      }}
                      placeholder="123456789012"
                      maxLength={12}
                    />
                    {formErrors.aadhaar && (
                      <div className="text-danger text-xs mt-1">{formErrors.aadhaar}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Phone Number <span className="text-danger">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, phone: value });
                      }}
                      placeholder="9876543210"
                      maxLength={10}
                    />
                    {formErrors.phone && (
                      <div className="text-danger text-xs mt-1">{formErrors.phone}</div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Address <span className="text-danger">*</span>
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="House No., Street, Locality"
                    rows={2}
                    className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text outline-none focus:border-accent resize-none"
                  />
                  {formErrors.address && (
                    <div className="text-danger text-xs mt-1">{formErrors.address}</div>
                  )}
                </div>

                {/* City & State */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      City <span className="text-danger">*</span>
                    </label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Bangalore"
                    />
                    {formErrors.city && (
                      <div className="text-danger text-xs mt-1">{formErrors.city}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      State <span className="text-danger">*</span>
                    </label>
                    <Select
                      options={[
                        { value: '', label: 'Select state...' },
                        ...STATES.map((s) => ({ value: s, label: s })),
                      ]}
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                    {formErrors.state && (
                      <div className="text-danger text-xs mt-1">{formErrors.state}</div>
                    )}
                  </div>
                </div>

                {/* DOB & Gender */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Date of Birth <span className="text-danger">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    {formErrors.dob && (
                      <div className="text-danger text-xs mt-1">{formErrors.dob}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text mb-1">
                      Gender <span className="text-danger">*</span>
                    </label>
                    <Select
                      options={[
                        { value: '', label: 'Select...' },
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                        { value: 'Other', label: 'Other' },
                      ]}
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    />
                    {formErrors.gender && (
                      <div className="text-danger text-xs mt-1">{formErrors.gender}</div>
                    )}
                  </div>
                </div>

                {/* Managed By & Type (Read-only) */}
                <div className="bg-surface2 border border-border rounded-lg p-4">
                  <div className="text-xs font-semibold text-text3 uppercase mb-2">
                    Assignment Details
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text3">Managed By:</span>{' '}
                      <span className="text-text font-semibold">{proctorData.managed_by}</span>
                    </div>
                    <div>
                      <span className="text-text3">Type:</span>{' '}
                      <span className="text-text font-semibold">{proctorData.ptype}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <Button
                  type="submit"
                  variant="success"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : '✅ Submit Onboarding Form'}
                </Button>
              </div>
            </form>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-2xl font-bold text-text mb-3">
                Registration Complete!
              </h2>
              <p className="text-text2 mb-6">
                Thank you for completing your onboarding form. Our team will review your
                information and contact you soon.
              </p>
              <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-sm text-success">
                ✅ Your profile has been successfully submitted
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
