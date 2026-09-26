import { config } from '../config.ts';

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** 默认：控制台邮件（开发态可见链接） */
const consoleMailer: Mailer = {
  async send(to, subject, text) {
    console.log(`[mailer:console] to=${to} subject=${subject}\n${text}`);
  },
};

/** 配置 SMTP_HOST 时改用 nodemailer（需安装 nodemailer） */
function smtpMailer(): Mailer {
  return {
    async send(to, subject, text) {
      const mod = await import('nodemailer');
      const nodemailer = (mod as { default?: unknown }).default ?? mod;
      const transport = (nodemailer as { createTransport: (o: unknown) => { sendMail: (m: unknown) => Promise<unknown> } }).createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
      });
      await transport.sendMail({ from: config.smtpFrom, to, subject, text });
    },
  };
}

export const mailer: Mailer = config.smtpHost ? smtpMailer() : consoleMailer;
