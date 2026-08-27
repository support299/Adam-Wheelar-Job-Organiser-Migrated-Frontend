// Shared types mirroring Django models

export type Job = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  ghl_contact_id: string | null;
  address: string;
  lat: number;
  lng: number;
  service_date: string;
  service_time: string;
  service_value: number;
  status: string;
  notes: string | null;
  is_recurring: boolean;
  frequency: string | null;
  service_type: string;
  sale_date: string | null;
  payment_status: string | null;
  call_status: string | null;
  calls_made: number;
  completed_at: string | null;
  duration: number;
  parent_job_id: string | null;
  occurrence_index: number | null;
  series_count: number | null;
  child_job_ids?: string[];
  staff_ids: string[];
  last_call_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobInsert = Omit<Job, "id" | "created_at" | "updated_at" | "staff_ids" | "last_call_at"> & {
  occurrences?: number;
  staff_ids?: string[];
  product_lines?: JobProductLine[];
};
export type JobUpdate = Partial<JobInsert>;

export type JobProduct = {
  id: string;
  job_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type JobProductLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type Staff = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "user";
  active: boolean;
  color: string | null;
  has_login: boolean;
  created_at: string;
};

export type StaffRole = "admin" | "user";
export type StaffInsert = Omit<Staff, "id" | "has_login" | "created_at">;
export type StaffUpdate = Partial<StaffInsert>;

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type ProductInsert = Omit<Product, "id" | "created_at">;
export type ProductUpdate = Partial<ProductInsert>;

export type Activity = {
  id: number;
  body: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ActivityInsert = { body: string };
export type ActivityUpdate = Partial<ActivityInsert>;

export type BaseLocation = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  created_at: string;
};

export type BaseLocationInsert = Omit<BaseLocation, "id" | "created_at">;
export type BaseLocationUpdate = Partial<BaseLocationInsert>;

export type SavedPlan = {
  id: string;
  name: string;
  plan_date: string;
  ordered_job_ids: string[];
  staff_ids: string[];
  base_id: string | null;
  base_name: string | null;
  route_shape: string | null;
  optimize_metric: string | null;
  road_km: number | null;
  road_minutes: number | null;
  notes: string | null;
  legs: unknown;
  total_km: number;
  jobs: Job[];
  progress: JobProgress[];
  created_at: string;
  updated_at: string;
};

export type SavedPlanInsert = Omit<SavedPlan, "id" | "created_at" | "updated_at" | "jobs" | "progress">;
export type SavedPlanUpdate = Partial<SavedPlanInsert>;

export type JobProgress = {
  id: string;
  plan: string;
  job_id: string;
  staff_id: string;
  status: string;
  actual_km: number | null;
  notes: string | null;
  updated_at: string;
};

export type StaffPayout = {
  id: number;
  staff_id: string;
  period_from: string;
  period_to: string;
  amount: number;
  notes: string | null;
  paid_at: string;
};

export type GhlContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  location_id: string | null;
  assigned_user_id: string | null;
  synced_at: string;
};

export type GhlUser = {
  id: string;
  name: string | null;
  email: string | null;
  location_id: string | null;
  synced_at: string;
};

export type ContactNote = {
  id: string;
  contact_key: string;
  job_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type GhlTokenStatus = {
  company: {
    expires_at: string;
    location_id: string | null;
    company_id: string | null;
    user_type: string | null;
    scope: string | null;
    updated_at: string;
  } | null;
  location: {
    expires_at: string;
    location_id: string | null;
    company_id: string | null;
    user_type: string | null;
    scope: string | null;
    updated_at: string;
  } | null;
};

export type GhlInstallConfig = {
  configured: boolean;
  clientId: string;
  locationId: string;
  scopes: string;
};

export type PurchaseHistoryRow = {
  id: string;
  install_date: string;
  install_status: string;
  address: string;
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  total: string;
  next_service_date: string | null;
  next_service_status: string | null;
  is_recurring: boolean;
  frequency: string | null;
  service_complete: boolean;
};
