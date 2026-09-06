import type {
  Coach, Client, IndividualStudentDetails, SchoolDetails,
  Session, Invoice, InvoiceSession, Expense
} from '../types';

export const MOCK_COACH: Coach = {
  id: 'coach-001',
  name: 'Thabo Nkosi',
  email: 'thabo@chessops.co.za',
  phone: '+27 82 345 6789',
  business_name: 'Nkosi Chess Academy',
  currency: 'ZAR',
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-001',
    coach_id: 'coach-001',
    client_type: 'individual',
    display_name: 'Amahle Dlamini',
    email: 'parent.dlamini@gmail.com',
    whatsapp: '+27 73 112 3344',
    preferred_communication: 'whatsapp',
    notifications_enabled: true,
    notes: 'Keen learner, preparing for U14 provincials.',
    active: true,
  },
  {
    id: 'client-002',
    coach_id: 'coach-001',
    client_type: 'individual',
    display_name: 'Liam van der Berg',
    email: 'cvanderberg@outlook.com',
    whatsapp: '+27 61 998 7766',
    preferred_communication: 'both',
    notifications_enabled: true,
    notes: 'Intermediate level. Sessions on Tuesdays and Thursdays.',
    active: true,
  },
  {
    id: 'client-003',
    coach_id: 'coach-001',
    client_type: 'individual',
    display_name: 'Sipho Mokoena',
    email: 'nmokoena@webmail.co.za',
    whatsapp: '+27 84 567 8901',
    preferred_communication: 'email',
    notifications_enabled: false,
    notes: 'Beginner. Parent prefers email only.',
    active: true,
  },
  {
    id: 'client-004',
    coach_id: 'coach-001',
    client_type: 'individual',
    display_name: 'Priya Naidoo',
    email: 'snaidoo@gmail.com',
    whatsapp: '+27 79 234 5678',
    preferred_communication: 'whatsapp',
    notifications_enabled: true,
    notes: 'Advanced. Targeting national qualifiers.',
    active: false,
  },
  {
    id: 'client-005',
    coach_id: 'coach-001',
    client_type: 'school',
    display_name: 'Greenfields Primary',
    email: 'admin@greenfieldsprimary.co.za',
    whatsapp: '+27 11 456 7890',
    preferred_communication: 'email',
    notifications_enabled: true,
    notes: 'Wednesday afternoons, school hall. 25 learners.',
    active: true,
  },
  {
    id: 'client-006',
    coach_id: 'coach-001',
    client_type: 'school',
    display_name: 'Sunridge High School',
    email: 'chess@sunridgehigh.co.za',
    whatsapp: '+27 21 789 0123',
    preferred_communication: 'both',
    notifications_enabled: true,
    notes: 'Friday mornings. 15 learners in the chess club.',
    active: true,
  },
];

export const MOCK_INDIVIDUAL_DETAILS: IndividualStudentDetails[] = [
  { client_id: 'client-001', student_name: 'Amahle Dlamini', school_name: 'Rosebank College Prep', parent_name: 'Zanele Dlamini' },
  { client_id: 'client-002', student_name: 'Liam van der Berg', school_name: 'St. Andrew\'s School', parent_name: 'Christiaan van der Berg' },
  { client_id: 'client-003', student_name: 'Sipho Mokoena', school_name: '', parent_name: 'Ntombi Mokoena' },
  { client_id: 'client-004', student_name: 'Priya Naidoo', school_name: 'Westville Girls\' High', parent_name: 'Suresh Naidoo' },
];

export const MOCK_SCHOOL_DETAILS: SchoolDetails[] = [
  { client_id: 'client-005', school_name: 'Greenfields Primary', contact_person: 'Mrs. Karen Botha', learner_range: '20-30' },
  { client_id: 'client-006', school_name: 'Sunridge High School', contact_person: 'Mr. David Pietersen', learner_range: '10-20' },
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: 'session-001', coach_id: 'coach-001', client_id: 'client-001',
    date: '2026-09-08', start_time: '14:00', planned_duration: 60, actual_duration: null,
    session_type: 'in-person', location: 'Rosebank Library', status: 'scheduled', notes: '',
  },
  {
    id: 'session-002', coach_id: 'coach-001', client_id: 'client-002',
    date: '2026-09-09', start_time: '16:00', planned_duration: 60, actual_duration: null,
    session_type: 'online', location: '', status: 'scheduled', notes: 'Tactics session — forks and pins.',
  },
  {
    id: 'session-003', coach_id: 'coach-001', client_id: 'client-005',
    date: '2026-09-10', start_time: '14:30', planned_duration: 90, actual_duration: null,
    session_type: 'in-person', location: 'School Hall', status: 'scheduled', notes: '',
  },
  {
    id: 'session-004', coach_id: 'coach-001', client_id: 'client-006',
    date: '2026-09-12', start_time: '08:00', planned_duration: 60, actual_duration: null,
    session_type: 'in-person', location: 'Library Room B', status: 'scheduled', notes: '',
  },
  {
    id: 'session-005', coach_id: 'coach-001', client_id: 'client-001',
    date: '2026-08-25', start_time: '14:00', planned_duration: 60, actual_duration: 55,
    session_type: 'in-person', location: 'Rosebank Library', status: 'completed', notes: 'Covered endgame rook techniques.',
  },
  {
    id: 'session-006', coach_id: 'coach-001', client_id: 'client-002',
    date: '2026-08-26', start_time: '16:00', planned_duration: 60, actual_duration: 60,
    session_type: 'online', location: '', status: 'completed', notes: '',
  },
  {
    id: 'session-007', coach_id: 'coach-001', client_id: 'client-003',
    date: '2026-08-20', start_time: '10:00', planned_duration: 45, actual_duration: 45,
    session_type: 'in-person', location: 'Client home', status: 'completed', notes: 'Basics of piece movement.',
  },
  {
    id: 'session-008', coach_id: 'coach-001', client_id: 'client-005',
    date: '2026-08-27', start_time: '14:30', planned_duration: 90, actual_duration: 85,
    session_type: 'in-person', location: 'School Hall', status: 'completed', notes: 'Group opening theory.',
  },
  {
    id: 'session-009', coach_id: 'coach-001', client_id: 'client-006',
    date: '2026-08-29', start_time: '08:00', planned_duration: 60, actual_duration: 60,
    session_type: 'in-person', location: 'Library Room B', status: 'completed', notes: '',
  },
  {
    id: 'session-010', coach_id: 'coach-001', client_id: 'client-001',
    date: '2026-08-15', start_time: '14:00', planned_duration: 60, actual_duration: null,
    session_type: 'in-person', location: 'Rosebank Library', status: 'cancelled', notes: 'Student unwell.',
  },
  {
    id: 'session-011', coach_id: 'coach-001', client_id: 'client-002',
    date: '2026-07-28', start_time: '16:00', planned_duration: 60, actual_duration: 60,
    session_type: 'online', location: '', status: 'completed', notes: '',
  },
  {
    id: 'session-012', coach_id: 'coach-001', client_id: 'client-003',
    date: '2026-07-22', start_time: '10:00', planned_duration: 45, actual_duration: 40,
    session_type: 'in-person', location: 'Client home', status: 'completed', notes: '',
  },
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-001', coach_id: 'coach-001', client_id: 'client-001',
    invoice_date: '2026-08-31', due_date: '2026-09-07',
    amount: 800, description: 'August sessions — Amahle Dlamini (2 sessions)',
    status: 'unpaid', paid_date: null, payment_method: null, payment_reference: '', notes: '',
  },
  {
    id: 'inv-002', coach_id: 'coach-001', client_id: 'client-002',
    invoice_date: '2026-08-31', due_date: '2026-09-07',
    amount: 900, description: 'August sessions — Liam van der Berg (2 sessions)',
    status: 'paid', paid_date: '2026-09-02', payment_method: 'eft',
    payment_reference: 'EFT-20260902-LVB', notes: '',
  },
  {
    id: 'inv-003', coach_id: 'coach-001', client_id: 'client-005',
    invoice_date: '2026-08-31', due_date: '2026-09-14',
    amount: 2800, description: 'August group sessions — Greenfields Primary (2 sessions)',
    status: 'unpaid', paid_date: null, payment_method: null, payment_reference: '', notes: 'Awaiting school purchase order.',
  },
  {
    id: 'inv-004', coach_id: 'coach-001', client_id: 'client-006',
    invoice_date: '2026-08-31', due_date: '2026-09-14',
    amount: 1800, description: 'August sessions — Sunridge High School',
    status: 'paid', paid_date: '2026-09-04', payment_method: 'eft',
    payment_reference: 'SHS-AUG26', notes: '',
  },
  {
    id: 'inv-005', coach_id: 'coach-001', client_id: 'client-003',
    invoice_date: '2026-08-31', due_date: '2026-09-07',
    amount: 350, description: 'August session — Sipho Mokoena',
    status: 'paid', paid_date: '2026-09-01', payment_method: 'cash',
    payment_reference: '', notes: '',
  },
  {
    id: 'inv-006', coach_id: 'coach-001', client_id: 'client-001',
    invoice_date: '2026-07-31', due_date: '2026-08-07',
    amount: 400, description: 'July session — Amahle Dlamini',
    status: 'paid', paid_date: '2026-08-05', payment_method: 'eft',
    payment_reference: '', notes: '',
  },
  {
    id: 'inv-007', coach_id: 'coach-001', client_id: 'client-002',
    invoice_date: '2026-07-31', due_date: '2026-08-07',
    amount: 450, description: 'July session — Liam van der Berg',
    status: 'paid', paid_date: '2026-08-03', payment_method: 'eft',
    payment_reference: '', notes: '',
  },
];

export const MOCK_INVOICE_SESSIONS: InvoiceSession[] = [
  { invoice_id: 'inv-001', session_id: 'session-005' },
  { invoice_id: 'inv-001', session_id: 'session-010' },
  { invoice_id: 'inv-002', session_id: 'session-006' },
  { invoice_id: 'inv-002', session_id: 'session-011' },
  { invoice_id: 'inv-003', session_id: 'session-008' },
  { invoice_id: 'inv-004', session_id: 'session-009' },
  { invoice_id: 'inv-005', session_id: 'session-007' },
  { invoice_id: 'inv-006', session_id: 'session-012' },
  { invoice_id: 'inv-007', session_id: 'session-011' },
];

export const MOCK_EXPENSES: Expense[] = [
  { id: 'exp-001', coach_id: 'coach-001', date: '2026-09-03', amount: 420, category: 'transport', description: 'Fuel — Rosebank + Greenfields trips' },
  { id: 'exp-002', coach_id: 'coach-001', date: '2026-09-01', amount: 199, category: 'internet', description: 'Mobile data bundle' },
  { id: 'exp-003', coach_id: 'coach-001', date: '2026-08-28', amount: 650, category: 'chess_materials', description: 'Chess sets for Greenfields Primary' },
  { id: 'exp-004', coach_id: 'coach-001', date: '2026-08-22', amount: 180, category: 'transport', description: 'Fuel — August school visits' },
  { id: 'exp-005', coach_id: 'coach-001', date: '2026-08-15', amount: 95, category: 'food', description: 'Lunch during long session day' },
  { id: 'exp-006', coach_id: 'coach-001', date: '2026-07-30', amount: 1200, category: 'equipment', description: 'Digital chess clock' },
  { id: 'exp-007', coach_id: 'coach-001', date: '2026-07-18', amount: 320, category: 'transport', description: 'Fuel — July' },
];