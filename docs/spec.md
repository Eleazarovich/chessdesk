# Chess Coach Operations App — MVP Specification

## 1. Product Overview

A lightweight operations and business-management application built specifically for independent chess coaches in South Africa.

The app helps a coach manage:
- Individual students and their parents/guardians
- School clients
- Coaching schedules
- Session records
- Parent/school communication
- Invoicing records
- Payment tracking
- Business expenses
- Basic income and business performance

The app is designed for small independent coaches who may manage roughly 1–20 individual students, a few schools, or a mixture of both.

The goal is not to replace accounting software or payment platforms. The goal is to give a chess coach one simple place to manage day-to-day coaching operations and understand how their coaching business is performing.

---

## 2. Core Product Principle

The MVP should answer two questions:

1. **What coaching work do I need to manage?**
2. **How is my coaching business doing financially?**

The product should remain simple enough that a coach can update their records quickly between or after lessons.

---

## 3. User Type

### Primary User
Independent chess coach.

The MVP is a single-user application.

There is no parent portal, school portal, learner login, or staff management.

Parents and schools only interact with the coach through automated communication sent by the application.

---

## 4. Client Types

The application supports two client types.

### 4.1 Individual Student

An individual student record contains:

- Student name
- School name (optional)
- Parent/guardian name
- Parent/guardian WhatsApp number
- Parent/guardian email address
- Preferred communication method:
  - WhatsApp
  - Email
  - Both
- Session notifications:
  - Enabled
  - Disabled
- Optional notes

At least one communication method should be available.

---

### 4.2 School Client

A school is treated as a client itself.

A school record contains:

- School name
- Contact person's name
- Contact WhatsApp number
- Contact email address
- Preferred communication method:
  - WhatsApp
  - Email
  - Both
- Approximate learner range
  - 1–10
  - 10–20
  - 20–30
  - 30–40
  - 40+
- Session notifications:
  - Enabled
  - Disabled
- Optional notes

The coach does not need to maintain individual learner records for a school.

Learner numbers are intentionally approximate because participation can fluctuate.

---

## 5. Client Overview

The coach should be able to view:

- All individual students
- All school clients
- Active clients
- Basic contact information
- Upcoming session
- Outstanding amount
- Recent session history

The coach should be able to search or filter clients by name and client type.

---

## 6. Scheduling

The coach can schedule sessions for either:

- An individual student
- A school

### Session Fields

Each scheduled session contains:

- Client
- Date
- Start time
- Planned duration
- Session type:
  - Online
  - In-person
- Location if in-person
- Optional notes
- Session status

### Session Statuses

The MVP session lifecycle is:

**Scheduled → Updated → Completed**

or

**Scheduled → Cancelled**

Possible statuses:

- Scheduled
- Completed
- Cancelled

Updates do not require a separate permanent status. The system should store the latest schedule information and an activity/history record where practical.

---

## 7. Automated Session Communication

Communication is automatic when notifications are enabled for the client.

Messages are sent using the client's preferred communication method:

- WhatsApp
- Email
- Both

### 7.1 Session Scheduled

Immediately after a session is scheduled, send confirmation containing:

- Student or school name
- Session date
- Session time
- Expected duration
- Online or in-person
- Location if applicable

---

### 7.2 Session Updated

If the coach changes important session information, automatically send an update.

Examples:

- Date changed
- Time changed
- Location changed
- Session switched from online to in-person
- Session switched from in-person to online

The message should clearly state the new session details.

---

### 7.3 Session Cancelled

If the coach cancels a session, automatically send a cancellation message.

The communication should include:

- Student/school
- Original session date
- Original session time
- Cancellation confirmation

---

### 7.4 Session Completed

When the coach marks a session as completed, the coach records the actual session information.

Fields:

- Actual date
- Actual duration
- Online or in-person
- Location if applicable
- Optional internal notes

When saved, the system sends a session-completed confirmation if notifications are enabled.

The confirmation should include:

- Student or school name
- Date
- Duration
- Online/in-person
- Location if applicable

This creates a lightweight record for both the coach and client that the coaching session took place.

---

## 8. Notification Preferences

Each client can independently control whether routine session notifications are sent.

### Settings

- Notifications ON
- Notifications OFF

This allows parents or schools with frequent sessions to opt out of routine communication.

Important operational messages can initially follow the same setting in the MVP.

More granular notification controls can be added later if needed.

---

## 9. Session Recording

The coach does not have to record session information immediately.

This is important for coaches who run several lessons back-to-back.

The system should allow the coach to:

1. Schedule sessions in advance.
2. Complete several sessions.
3. Return later.
4. Update each session individually with actual information.

The app should clearly show sessions that are scheduled but have not yet been marked completed or cancelled.

---

## 10. Invoicing

The MVP does not need a predefined pricing engine.

Chess coaches often negotiate different pricing arrangements with different clients.

Pricing may vary based on:

- Student
- School
- Session duration
- Online coaching
- In-person coaching
- Location
- Existing private agreement

Therefore, the coach manually enters the amount when creating an invoice.

### Invoice Fields

- Client
- Invoice date
- One or more related sessions
- Description
- Amount charged
- Due date
- Payment status
- Optional notes

### Payment Status

- Unpaid
- Paid

Optional future status:

- Partially paid

For the MVP, unpaid and paid are sufficient.

---

## 11. Flexible Invoicing

Session recording and invoicing are separate actions.

A completed lesson does not automatically need to become an invoice immediately.

The coach can:

- Invoice one completed session
- Wait and invoice later
- Group several completed sessions into one invoice

This supports coaches who charge:

- Per lesson
- Weekly
- Monthly
- Through custom arrangements

The application does not need to understand the pricing agreement itself.

---

## 12. Payments

Payments do not happen inside the application.

The coach receives payment externally using methods such as:

- EFT
- Cash
- Other external payment methods

After receiving payment, the coach manually updates the invoice.

### Payment Record

When marking an invoice paid, the coach can record:

- Date paid
- Payment method
  - EFT
  - Cash
  - Other
- Optional reference/note

The application then stores the payment as part of the coach's financial records.

No payment gateway is required in the MVP.

---

## 13. Expenses

Expense tracking is completely private.

No expense information is ever communicated to parents, students, or schools.

Expense tracking is optional.

### Expense Fields

- Date
- Amount
- Category
- Optional description

### Suggested Categories

- Transport / Petrol
- Food
- Equipment
- Internet / Data
- Venue
- Chess materials
- Other

The coach can add an expense whenever they want.

Expenses do not need to be linked to individual sessions or clients in the MVP.

---

## 14. Financial Definitions

To avoid confusion, the MVP should use clear financial terminology.

### Revenue Earned
Total amount invoiced during the selected period.

### Payments Received
Money the coach has actually marked as paid.

### Outstanding
Invoices that have not yet been paid.

### Expenses
Total expenses recorded during the selected period.

### Net Income
Payments Received minus Expenses.

Formula:

`Net Income = Payments Received - Expenses`

---

## 15. Dashboard

The dashboard is the application's home screen.

Its purpose is to quickly answer:

**How is my coaching business doing?**

### Main Financial Overview

Example:

- Revenue Earned: R12,500
- Payments Received: R10,000
- Outstanding: R2,500
- Expenses: R3,200
- Net Income: R6,800

### Business Activity Overview

Show:

- Number of active individual students
- Number of active schools
- Sessions completed
- Upcoming sessions
- Unpaid invoices

Example:

- 8 individual students
- 2 schools
- 14 sessions completed
- 4 upcoming sessions
- 3 unpaid invoices

### Upcoming Sessions

The dashboard should display the coach's nearest upcoming sessions.

For each session show:

- Client
- Date
- Time
- Online/in-person
- Location if relevant

---

## 16. Dashboard Time Filters

The coach should be able to view performance for:

- This month
- Previous month
- Custom date range

If custom date ranges make the MVP unnecessarily complex, the first implementation may start with:

- This month
- Previous month
- All time

---

## 17. Main Navigation

Recommended MVP navigation:

1. Dashboard
2. Clients
3. Schedule
4. Sessions
5. Invoices
6. Expenses
7. Settings

Clients contains both:

- Individual Students
- Schools

---

## 18. Suggested Core Workflows

### Workflow A — Add Individual Student

1. Coach selects "Add Client".
2. Selects "Individual Student".
3. Enters student information.
4. Enters parent/guardian information.
5. Selects preferred communication channel.
6. Enables/disables notifications.
7. Saves client.

---

### Workflow B — Add School

1. Coach selects "Add Client".
2. Selects "School".
3. Enters school name.
4. Enters school contact details.
5. Selects approximate learner range.
6. Selects preferred communication channel.
7. Enables/disables notifications.
8. Saves client.

---

### Workflow C — Schedule Session

1. Select client.
2. Choose date and time.
3. Enter expected duration.
4. Choose online or in-person.
5. Add location if required.
6. Save session.
7. Application automatically sends confirmation if notifications are enabled.

---

### Workflow D — Update Session

1. Coach opens scheduled session.
2. Changes date, time, format, or location.
3. Saves changes.
4. Application sends updated details automatically.

---

### Workflow E — Cancel Session

1. Coach opens scheduled session.
2. Selects Cancel.
3. Session becomes cancelled.
4. Application sends cancellation confirmation automatically.

---

### Workflow F — Complete Session

1. Coach opens session.
2. Selects Mark Completed.
3. Records actual duration.
4. Confirms online/in-person.
5. Confirms location if relevant.
6. Adds optional notes.
7. Saves.
8. Application sends completed-session confirmation if notifications are enabled.

---

### Workflow G — Create Invoice

1. Coach opens client or completed sessions.
2. Selects one or multiple sessions.
3. Creates invoice.
4. Manually enters amount.
5. Adds description.
6. Sets due date.
7. Saves invoice.
8. Invoice becomes Unpaid.

The MVP may allow the coach to send the invoice through the client's preferred communication method.

---

### Workflow H — Record Payment

1. Coach receives payment externally.
2. Opens invoice.
3. Selects Mark Paid.
4. Records payment date.
5. Selects payment method.
6. Adds optional reference.
7. Saves.
8. Dashboard updates automatically.

---

### Workflow I — Record Expense

1. Coach selects Add Expense.
2. Enters date.
3. Enters amount.
4. Selects category.
5. Adds optional description.
6. Saves.
7. Dashboard financial figures update.

---

## 19. Communication Templates

Messages should be short, professional, and easy to understand.

### Scheduled Session

Example:

Chess session scheduled for [Student/School].

Date: [Date]
Time: [Time]
Duration: [Duration]
Format: [Online/In-person]
Location: [Location]

---

### Updated Session

Example:

Your chess session details have been updated.

Date: [Date]
Time: [Time]
Duration: [Duration]
Format: [Online/In-person]
Location: [Location]

---

### Cancelled Session

Example:

The chess session scheduled for [Date] at [Time] has been cancelled.

---

### Completed Session

Example:

Chess session completed.

Student/School: [Name]
Date: [Date]
Duration: [Duration]
Format: [Online/In-person]
Location: [Location]

---

## 20. Authentication

The MVP requires simple coach authentication.

Required:

- Sign up
- Log in
- Log out
- Password reset

Each coach sees only their own business data.

---

## 21. Settings

Basic settings should include:

### Coach Profile

- Coach name
- Business/coaching name (optional)
- Phone number
- Email
- Default currency

Default currency for South African coaches:

`ZAR (R)`

### Communication Settings

Where technically required:

- Email sending configuration
- WhatsApp sending configuration

---

## 22. Suggested Core Data Entities

### Coach
- id
- name
- email
- phone
- business_name
- currency

### Client
- id
- coach_id
- client_type
- display_name
- email
- whatsapp
- preferred_communication
- notifications_enabled
- notes
- active

### Individual Student Details
- client_id
- student_name
- school_name
- parent_name

### School Details
- client_id
- school_name
- contact_person
- learner_range

### Session
- id
- coach_id
- client_id
- date
- start_time
- planned_duration
- actual_duration
- session_type
- location
- status
- notes

### Invoice
- id
- coach_id
- client_id
- invoice_date
- due_date
- amount
- description
- status
- paid_date
- payment_method
- payment_reference

### Invoice Session
Used to connect one invoice to one or more sessions.

- invoice_id
- session_id

### Expense
- id
- coach_id
- date
- amount
- category
- description

---

## 23. MVP Functional Requirements

The MVP is successful if a coach can:

- Create an account
- Add an individual student
- Add a school client
- Store client contact information
- Set preferred communication method
- Enable or disable client notifications
- Schedule a coaching session
- Update a scheduled session
- Cancel a scheduled session
- Mark a session completed
- Send automatic session communications
- View upcoming sessions
- View completed session history
- Create invoices manually
- Attach sessions to invoices
- Mark invoices paid
- Record payment method
- Track outstanding invoices
- Record expenses
- See revenue
- See payments received
- See outstanding money
- See expenses
- See net income
- View core business performance from the dashboard

---

## 24. Explicitly Out of Scope for MVP

The following should NOT be built initially:

- Parent accounts
- Student accounts
- School portals
- Learner attendance lists within schools
- Online payments
- Payment gateways
- Subscription billing
- Automated bank reconciliation
- Full accounting
- Tax calculations
- VAT management
- Payroll
- Employee management
- Coach teams
- Advanced CRM
- Complex pricing rules
- Automatic hourly-rate calculations
- Mileage calculations
- Receipt scanning
- Receipt uploads
- Advanced financial reports
- Profit-and-loss accounting statements
- AI features
- Chess lesson content
- Chess game analysis
- Chess engine integrations
- Tournament management
- Learner progress tracking
- Group-class learner management
- Parent self-service scheduling
- Calendar marketplace/bookings
- Native mobile apps

These can be reconsidered after the core product has proven useful.

---

## 25. MVP Design Principles

### Simple
Every common action should require as few steps as possible.

### Fast
A coach should be able to record a completed session in under a minute.

### Mobile Friendly
Many coaches will update the system from their phone between lessons.

The web interface should therefore be responsive and work well on mobile devices.

### Low Administrative Burden
The application should reduce admin work rather than create more of it.

### Flexible
Coaches have different agreements with parents and schools.

The application should record what happened without forcing the coach into rigid billing rules.

### Private
Financial and expense information is visible only to the coach.

---

## 26. MVP Success Scenario

A coach should be able to start their day by opening the dashboard and immediately see:

- How much money they have earned
- How much money has actually been received
- How much is still outstanding
- How much they have spent
- Their net income
- Their upcoming coaching sessions

They should then be able to run their coaching day using the same application:

**Schedule → Coach → Complete → Communicate → Invoice → Record Payment**

without needing spreadsheets, manual invoice tracking, or repeatedly searching through WhatsApp conversations.

---

## 27. Product Vision in One Sentence

**A simple operations and financial management tool that helps independent chess coaches manage clients, sessions, communication, invoices, payments, and expenses from one place.**

---

## 28. MVP Priority Order

If development needs to be staged, build in this order:

1. Authentication
2. Client management
3. Session scheduling
4. Session lifecycle
5. Dashboard/upcoming sessions
6. Email/WhatsApp communications
7. Completed session records
8. Invoice creation
9. Payment tracking
10. Expense tracking
11. Financial dashboard calculations

The application should only expand beyond this scope after the core workflow is working reliably.
