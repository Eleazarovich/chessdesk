export type ClientType = 'individual' | 'school';
export type CommunicationPreference = 'whatsapp' | 'email' | 'both';
export type SessionType = 'online' | 'in-person';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type InvoiceStatus = 'unpaid' | 'paid';
export type PaymentMethod = 'eft' | 'cash' | 'other';
export type ExpenseCategory = 'transport' | 'food' | 'equipment' | 'internet' | 'venue' | 'chess_materials' | 'other';
export type LearnerRange = '1-10' | '10-20' | '20-30' | '30-40' | '40+';
export type TimeFilter = 'this_month' | 'previous_month' | 'all_time';

export interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  business_name: string;
  currency: string;
}

export interface Client {
  id: string;
  coach_id: string;
  client_type: ClientType;
  display_name: string;
  email: string;
  whatsapp: string;
  preferred_communication: CommunicationPreference;
  notifications_enabled: boolean;
  notes: string;
  active: boolean;
}

export interface IndividualStudentDetails {
  client_id: string;
  student_name: string;
  school_name: string;
  parent_name: string;
}

export interface SchoolDetails {
  client_id: string;
  school_name: string;
  contact_person: string;
  learner_range: LearnerRange;
}

export interface Session {
  id: string;
  coach_id: string;
  client_id: string;
  date: string;
  start_time: string;
  planned_duration: number;
  actual_duration: number | null;
  session_type: SessionType;
  location: string;
  status: SessionStatus;
  notes: string;
}

export interface Invoice {
  id: string;
  coach_id: string;
  client_id: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  description: string;
  status: InvoiceStatus;
  paid_date: string | null;
  payment_method: PaymentMethod | null;
  payment_reference: string;
  notes: string;
}

export interface InvoiceSession {
  invoice_id: string;
  session_id: string;
}

export interface Expense {
  id: string;
  coach_id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
}

export interface DashboardFinancials {
  revenue_earned: number;
  payments_received: number;
  outstanding: number;
  expenses: number;
  net_income: number;
}

export interface DashboardActivity {
  active_individual_students: number;
  active_schools: number;
  sessions_completed: number;
  upcoming_sessions: number;
  unpaid_invoices: number;
}

export interface DashboardData {
  financials: DashboardFinancials;
  activity: DashboardActivity;
  upcoming_sessions: UpcomingSession[];
  revenue_chart: RevenueChartPoint[];
  sessions_chart: SessionsChartPoint[];
}

export interface UpcomingSession {
  session_id: string;
  client_name: string;
  date: string;
  start_time: string;
  session_type: SessionType;
  location: string;
}

export interface RevenueChartPoint {
  month: string;
  revenue: number;
  expenses: number;
  payments: number;
}

export interface SessionsChartPoint {
  month: string;
  completed: number;
  scheduled: number;
  cancelled: number;
}

export interface ClientWithDetails extends Client {
  individual_details?: IndividualStudentDetails;
  school_details?: SchoolDetails;
  upcoming_session?: string | null;
  outstanding_amount: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface NotificationPayload {
  client_id: string;
  type: 'scheduled' | 'updated' | 'cancelled' | 'completed';
  session: Session;
  client_name: string;
}