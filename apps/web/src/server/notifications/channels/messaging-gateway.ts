import type {
  EmailComposer,
  InviteEmailParams,
  PasswordResetEmailParams,
  AccountExpiringEmailParams,
  CampaignEmailParams,
  MeetingEmailParams,
} from "@crm/email-composer";
import type {
  DeliveryError,
  DeliveryReceipt,
  MessageChannels,
  Result,
} from "@crm/message-channels";

export interface MessagingGateway {
  // The ics is the iCalendar text; its method must match the one inside it.
  sendMeetingInvite(input: {
    to: string;
    params: MeetingEmailParams;
    ics: { method: "REQUEST" | "CANCEL"; content: string };
  }): Promise<Result<DeliveryReceipt, DeliveryError>>;
  sendInviteEmail(input: {
    to: string;
    params: InviteEmailParams;
  }): Promise<Result<DeliveryReceipt, DeliveryError>>;
  sendPasswordResetEmail(input: {
    to: string;
    params: PasswordResetEmailParams;
  }): Promise<Result<DeliveryReceipt, DeliveryError>>;
  sendAccountExpiringEmail(input: {
    to: string;
    params: AccountExpiringEmailParams;
  }): Promise<Result<DeliveryReceipt, DeliveryError>>;
  sendCampaignEmail(input: {
    to: string;
    params: CampaignEmailParams;
  }): Promise<Result<DeliveryReceipt, DeliveryError>>;
  sendWhatsAppText(input: {
    to: string;
    body: string;
  }): Promise<Result<DeliveryReceipt, DeliveryError>>;
}

export function createMessagingGateway(deps: {
  channels: MessageChannels;
  composer: EmailComposer;
}): MessagingGateway {
  return {
    sendMeetingInvite(input) {
      const email = deps.composer.meeting(input.params);
      return deps.channels.sendEmail({
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [
          {
            filename: "invite.ics",
            content: base64Utf8(input.ics.content),
            contentType: `text/calendar; charset=utf-8; method=${input.ics.method}`,
          },
        ],
      });
    },

    sendInviteEmail(input) {
      const email = deps.composer.invite(input.params);
      return deps.channels.sendEmail({
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    },

    sendPasswordResetEmail(input) {
      const email = deps.composer.passwordReset(input.params);
      return deps.channels.sendEmail({
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    },

    sendAccountExpiringEmail(input) {
      const email = deps.composer.accountExpiring(input.params);
      return deps.channels.sendEmail({
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    },

    sendCampaignEmail(input) {
      const email = deps.composer.campaign(input.params);
      return deps.channels.sendEmail({
        to: input.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    },

    sendWhatsAppText(input) {
      return deps.channels.sendWhatsAppText({
        to: input.to,
        body: input.body,
      });
    },
  };
}

function base64Utf8(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
