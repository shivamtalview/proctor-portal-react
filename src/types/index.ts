// Core types for the Proctor Portal

export type UserRole = 'admin' | 'vendor' | 'coordinator';

export type ProctorStatus = 'In Progress' | 'Verified' | 'Active' | 'Offboarded' | 'Archived';

export type ProctorType = 'WFO' | 'ODP' | 'Hybrid';

export type Vendor = 'Sai' | 'TSN' | 'Avner' | 'A&M' | 'ATS' | 'Awign';

export type EvaluationStatus = 
  | 'Not Started' 
  | 'Ready' 
  | 'Scheduled' 
  | 'Pass' 
  | 'Fail' 
  | 'Reattempt' 
  | 'No Show' 
  | 'Reschedule';

export type NDAStatus = 'Not Sent' | 'Shared' | 'NDA Signed';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  vendor?: Vendor;
  created_at: string;
  updated_at: string;
}

export interface Proctor {
  id: string;
  pid?: string;
  name: string;
  aadhaar: string;
  vendor?: string; // Used in HTML app (same as managed_by)
  phone: string;
  email: string;
  address?: string;
  city: string;
  state: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  ptype: ProctorType;
  bgv?: string;
  nda?: string;
  notes?: string;
  status: ProctorStatus;
  stage?: number;
  
  // Metadata (database column names)
  by_user?: string; // created by user
  at: string; // created timestamp
  upd: string; // updated timestamp
  vby?: string; // verified by
  vat?: string | null; // verified at
  aat?: string | null; // activated at
  oat?: string | null; // offboarded at
  off_reason?: string;
  off_notes?: string;
  
  // Evaluation fields
  demo_eval?: string;
  assessment?: string;
  demo_eval_link?: string;
  assessment_link?: string;
  demo_ready?: string;
  assessment_ready?: string;
  demo_ready_attempt?: number;
  assessment_ready_attempt?: number;
  
  // NDA fields
  nda_status?: string;
  nda_triggered_at?: string | null;
  nda_triggered_by?: string;
  nda_signed_at?: string | null;
  nda_file_url?: string;
  
  // Interview select / onboarding form fields
  interview_stage?: string;
  form_status?: string;
  form_link_token?: string;
  form_shared_at?: string | null;
  form_submitted_at?: string | null;
  managed_by: Vendor;
  vendor_verified?: boolean;
  vendor_verified_by?: string;
  vendor_verified_at?: string | null;
  final_form_status?: string;
  
  // Compatibility aliases (for React code readability)
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface InterviewSelect {
  id: string;
  email: string;
  managed_by: Vendor;
  ptype: ProctorType;
  notes?: string;
  form_status: 'not_sent' | 'shared' | 'submitted';
  form_link?: string;
  submitted_at?: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  proctor_id: string;
  proctor_email?: string;
  proctor_name?: string;
  eval_type: 'demo' | 'assessment'; // Database uses eval_type not type
  panel_id?: string;
  panel_user: string; // Database uses panel_user not panel_name
  scheduled_date: string;
  scheduled_time?: string;
  score?: number;
  score_out_of?: number;
  result?: 'Pass' | 'Fail' | 'Reattempt' | 'No Show' | 'Reschedule';
  comment?: string;
  attempt_number: number;
  certified_date?: string;
  group_id?: string;
  status?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  body: string;
  color?: 'red' | 'yellow' | 'green' | 'blue';
  colour?: 'red' | 'yellow' | 'green' | 'blue';
  done: boolean;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  ts: string;        // timestamp
  usr: string;       // username
  action: string;
  target: string;
  detail: string;
}

export interface AppConfig {
  key: string;
  value: string;
}

// Dashboard statistics
export interface DashboardStats {
  total: number;
  inProgress: number;
  verified: number;
  active: number;
  offboarded: number;
  byVendor: Record<Vendor, number>;
}

// Filter types
export interface ProctorFilters {
  search?: string;
  vendor?: Vendor | '';
  status?: ProctorStatus | '';
  ptype?: ProctorType | '';
}

export interface EvaluationFilters {
  search?: string;
  vendor?: Vendor | '';
  ptype?: ProctorType | '';
  result?: EvaluationStatus | '';
  date?: string;
}
