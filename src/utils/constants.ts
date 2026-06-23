import type { Vendor, ProctorType } from '@/types';

export const VENDORS: Vendor[] = ['Sai', 'TSN', 'Avner', 'A&M', 'ATS', 'Awign'];

export const PROCTOR_TYPES: ProctorType[] = ['WFO', 'ODP', 'Hybrid'];

export const PROCTOR_TYPE_LABELS: Record<ProctorType, string> = {
  WFO: 'WFO — Work from Office',
  ODP: 'ODP — On Demand Proctor',
  Hybrid: 'Hybrid — In Office On Demand',
};

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const STATUS_COLORS = {
  'In Progress': 'warning',
  Verified: 'info',
  Active: 'success',
  Offboarded: 'danger',
  Archived: 'secondary',
} as const;

export const STATUS_BADGES = {
  'In Progress': 'bg-warning/15 text-warning',
  Verified: 'bg-info/15 text-info',
  Active: 'bg-success/15 text-success',
  Offboarded: 'bg-danger/15 text-danger',
  Archived: 'bg-text3/15 text-text3',
} as const;
