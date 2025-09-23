import nodemailer from 'nodemailer'
import { logger } from '../logger.js'

/**
 * @brief Essential email service using Nodemailer
 */
class EmailService {
  constructor() {
    this.transporter = null;
    // Link directly to frontend page with token
    this.frontendUrl = "https://" + (process.env.HOST_DOMAIN || 'localhost');
    this.init();
  }

  init() {
    try {
      // Use Gmail SMTP if credentials are provided, otherwise console mode
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        logger.info('Email service initialized with Gmail SMTP');
      } else {
        logger.warn('Email service in console mode - EMAIL_USER and EMAIL_PASS not configured');
      }
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * @brief Send verification email to user
   */
  async sendVerificationEmail({ email, username, verificationToken }) {
    try {
      // Email links directly to frontend page with token
      const verificationUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@ft-transcendence.local',
        to: email,
        subject: 'Verify your ft_transcendence account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ft_transcendence!</h2>
            <p>Hello <strong>${username}</strong>,</p>
            <p>Please verify your email address to complete registration:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                Verify Email
              </a>
            </div>
            <p><small>Link expires in 24 hours.</small></p>
          </div>
        `
      };

      if (this.transporter) {
        const result = await this.transporter.sendMail(mailOptions);
        logger.info(`Verification email sent to ${email}`);
        return true;
      } else {
        // Console mode for development
        logger.info(`📧 VERIFICATION EMAIL (Console Mode):`);
        logger.info(`To: ${email}`);
        logger.info(`URL: ${verificationUrl}`);
        return true;
      }
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService()
export default emailService