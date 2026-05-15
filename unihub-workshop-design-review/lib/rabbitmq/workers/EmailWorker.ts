import { BaseWorker } from '../BaseWorker';
import { sendRegistrationConfirmationEmail } from '@/lib/email/send-email';

export class EmailWorker extends BaseWorker {
  protected queueName = 'email_queue';
  protected exchangeName = 'unihub_events';
  protected routingKey = 'email_job';

  protected async process(data: any): Promise<void> {
    const { type, payload } = data;

    if (type === 'registration_confirmation') {
      console.log(`[EmailWorker] Sending confirmation email to ${payload.studentEmail}`);
      
      await sendRegistrationConfirmationEmail({
        studentEmail: payload.studentEmail,
        studentName: payload.studentName,
        workshopTitle: payload.workshopTitle,
        workshopDate: payload.workshopDate,
        workshopTime: payload.workshopTime,
        roomName: payload.roomName,
        qrCodeDataUrl: payload.qrCodeDataUrl
      });
    } else if (type === 'cancellation_confirmation') {
      console.log(`[EmailWorker] Sending cancellation notice to ${payload.studentEmail} for ${payload.workshopTitle}`);
      // Ở đây sẽ gọi hàm gửi email hủy thực tế
      // await sendCancellationEmail(payload.studentEmail, payload.workshopTitle, payload.cancelReason);
    } else {
      console.warn(`[EmailWorker] Unknown email type: ${type}`);
    }
  }
}
