import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramService {
  private readonly baseUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;

  async sendMessage(message: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
    } catch (error) {
      console.error('❌ Error sending Telegram message:', error);
    }
  }

  async sendPhoto(photoUrl: string, caption?: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          photo: photoUrl,
          caption,
        }),
      });
    } catch (error) {
      console.error('❌ Error sending Telegram photo:', error);
    }
  }

  async sendDocument(fileUrl: string, caption?: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          document: fileUrl,
          caption,
        }),
      });
    } catch (error) {
      console.error('❌ Error sending Telegram document:', error);
    }
  }
}
