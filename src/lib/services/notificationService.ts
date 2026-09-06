import type { NotificationPayload } from '../types';

// BACKEND INTEGRATION POINT: Replace with real WhatsApp Business API or email service

function buildMessage(payload: NotificationPayload): string {
  const { type, session, client_name } = payload;
  const loc = session.location ? `\nLocation: ${session.location}` : '';
  const dur = session.actual_duration ?? session.planned_duration;

  switch (type) {
    case 'scheduled':
      return `Chess session scheduled for ${client_name}.\n\nDate: ${session.date}\nTime: ${session.start_time}\nDuration: ${session.planned_duration} min\nFormat: ${session.session_type}${loc}`;
    case 'updated':
      return `Your chess session details have been updated.\n\nDate: ${session.date}\nTime: ${session.start_time}\nDuration: ${session.planned_duration} min\nFormat: ${session.session_type}${loc}`;
    case 'cancelled':
      return `The chess session scheduled for ${session.date} at ${session.start_time} has been cancelled.`;
    case 'completed':
      return `Chess session completed.\n\nStudent/School: ${client_name}\nDate: ${session.date}\nDuration: ${dur} min\nFormat: ${session.session_type}${loc}`;
    default:
      return '';
  }
}

export const notificationService = {
  async send(payload: NotificationPayload): Promise<void> {
    await new Promise(r => setTimeout(r, 100));
    const message = buildMessage(payload);
    const client = { preferred_communication: 'whatsapp' }; // simplified for mock
    console.log(`[ChessOps Notification] Via ${client.preferred_communication.toUpperCase()}`);
    console.log(`To: ${payload.client_id}`);
    console.log(`Message:\n${message}\n`);
    // Mock: in real implementation, call WhatsApp Business API or email provider here
  },
};