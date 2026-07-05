import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';

export interface SmtpAuthConfig {
    user: string;
    pass: string;
}

export interface EmailServiceConfig {
    host?: string;
    port?: number | string;
    secure?: boolean;
    auth?: SmtpAuthConfig;
}

export class EmailService {
    private config: EmailServiceConfig;
    private from: string | undefined;
    private appUrl: string | undefined;
    private transporter: Transporter;

    constructor(config?: EmailServiceConfig) {
        this.config = config || {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER as string,
                pass: process.env.SMTP_PASS as string
            }
        };

        this.from = process.env.EMAIL_FROM;
        this.appUrl = process.env.APP_URL;

        this.transporter = nodemailer.createTransport(this.config as any);
    }

    /**
     * Send welcome email
     */
    async sendWelcomeEmail(email: string, firstName?: string): Promise<void> {
        try {
            const mailOptions: SendMailOptions = {
                from: this.from,
                to: email,
                subject: 'Welcome to Our Application',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
              .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome!</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName || 'there'}!</h2>
                <p>Thank you for registering with our application. We're excited to have you on board!</p>
                <p>You can now log in and start using our services.</p>
                <p><a href="${this.appUrl}/login" class="button">Login Now</a></p>
                <p>If you have any questions, feel free to contact our support team.</p>
                <p>Best regards,<br>The Team</p>
              </div>
            </div>
          </body>
          </html>
        `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('Welcome email sent to:', email);
        } catch (error) {
            console.error('Error sending welcome email:', error);
            throw error;
        }
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email: string, resetToken: string, firstName?: string): Promise<void> {
        try {
            const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;

            const mailOptions: SendMailOptions = {
                from: this.from,
                to: email,
                subject: 'Password Reset Request',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
              .button { display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; }
              .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName || 'there'}!</h2>
                <p>We received a request to reset your password. Click the button below to reset it:</p>
                <p><a href="${resetUrl}" class="button">Reset Password</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                <div class="warning">
                  <strong>⚠️ Important:</strong>
                  <ul>
                    <li>This link will expire in 1 hour</li>
                    <li>If you didn't request this reset, please ignore this email</li>
                    <li>Never share this link with anyone</li>
                  </ul>
                </div>
                <p>Best regards,<br>The Team</p>
              </div>
            </div>
          </body>
          </html>
        `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('Password reset email sent to:', email);
        } catch (error) {
            console.error('Error sending password reset email:', error);
            throw error;
        }
    }

    /**
     * Send account activation email
     */
    async sendActivationEmail(email: string, firstName?: string): Promise<void> {
        try {
            const mailOptions: SendMailOptions = {
                from: this.from,
                to: email,
                subject: 'Account Activated',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Account Activated</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName || 'there'}!</h2>
                <p>Your account has been activated and you can now access all features.</p>
                <p>If you have any questions, please contact our support team.</p>
                <p>Best regards,<br>The Team</p>
              </div>
            </div>
          </body>
          </html>
        `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('Activation email sent to:', email);
        } catch (error) {
            console.error('Error sending activation email:', error);
            throw error;
        }
    }

    /**
     * Send account deactivation email
     */
    async sendDeactivationEmail(email: string, firstName?: string): Promise<void> {
        try {
            const mailOptions: SendMailOptions = {
                from: this.from,
                to: email,
                subject: 'Account Deactivated',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Account Deactivated</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName || 'there'}!</h2>
                <p>Your account has been deactivated. You will not be able to log in until it is reactivated.</p>
                <p>If you believe this is a mistake, please contact our support team.</p>
                <p>Best regards,<br>The Team</p>
              </div>
            </div>
          </body>
          </html>
        `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('Deactivation email sent to:', email);
        } catch (error) {
            console.error('Error sending deactivation email:', error);
            throw error;
        }
    }

    /**
     * Send OTP email for login
     */
    async sendOTPEmail(
        email: string,
        otp: string | number,
        firstName?: string,
        expiryMinutes: number = 10
    ): Promise<void> {
        try {
            const mailOptions: SendMailOptions = {
                from: this.from,
                to: email,
                subject: 'Your Login OTP Code',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
              .otp-box { 
                background-color: #fff; 
                border: 2px dashed #2196F3; 
                padding: 20px; 
                text-align: center; 
                margin: 20px 0;
                border-radius: 8px;
              }
              .otp-code { 
                font-size: 36px; 
                font-weight: bold; 
                color: #2196F3; 
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
              }
              .warning { 
                background-color: #fff3cd; 
                border-left: 4px solid #ffc107; 
                padding: 10px; 
                margin: 15px 0; 
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Login OTP Code</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName || 'there'}!</h2>
                <p>You requested to login using OTP. Here is your one-time password:</p>
                
                <div class="otp-box">
                  <div class="otp-code">${otp}</div>
                  <p style="margin-top: 10px; color: #666;">Enter this code to complete your login</p>
                </div>

                <div class="warning">
                  <strong>⚠️ Important:</strong>
                  <ul style="margin: 5px 0;">
                    <li>This OTP will expire in <strong>${expiryMinutes} minutes</strong></li>
                    <li>Valid for <strong>3 attempts</strong> only</li>
                    <li>Never share this code with anyone</li>
                    <li>If you didn't request this, please ignore this email</li>
                  </ul>
                </div>

                <p style="margin-top: 20px;">If you're having trouble logging in, please contact our support team.</p>
                <p>Best regards,<br>The Team</p>
              </div>
            </div>
          </body>
          </html>
        `
            };

            await this.transporter.sendMail(mailOptions);
            console.log('OTP email sent to:', email);
        } catch (error) {
            console.error('Error sending OTP email:', error);
            throw error;
        }
    }

    /**
     * Verify email configuration
     */
    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            console.log('Email service is ready to send emails');
            return true;
        } catch (error) {
            console.error('Email service verification failed:', error);
            return false;
        }
    }
}

export default EmailService;