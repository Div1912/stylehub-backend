const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Load email template
const loadTemplate = async (templateName) => {
  const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
  const template = await fs.readFile(templatePath, 'utf-8');
  return handlebars.compile(template);
};

// Send email
exports.sendEmail = async ({ to, subject, template, context }) => {
  try {
    // Load and compile template
    const compiledTemplate = await loadTemplate(template);
    const html = compiledTemplate(context);

    // Send mail
    const info = await transporter.sendMail({
      from: `"StyleHub" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Email templates
exports.emailTemplates = {
  // Welcome email after registration
  welcome: {
    subject: 'Welcome to StyleHub!',
    template: 'welcome'
  },

  // Email verification
  verification: {
    subject: 'Verify your email address',
    template: 'verification'
  },

  // Password reset
  resetPassword: {
    subject: 'Reset your password',
    template: 'resetPassword'
  },

  // Order confirmation
  orderConfirmation: {
    subject: 'Order Confirmation',
    template: 'orderConfirmation'
  },

  // Order status update
  orderStatus: {
    subject: 'Order Status Update',
    template: 'orderStatus'
  },

  // Order shipping confirmation
  orderShipped: {
    subject: 'Your order has been shipped',
    template: 'orderShipped'
  },

  // Order delivery confirmation
  orderDelivered: {
    subject: 'Your order has been delivered',
    template: 'orderDelivered'
  },

  // Order cancellation
  orderCancellation: {
    subject: 'Order Cancellation Confirmation',
    template: 'orderCancellation'
  },

  // Return request confirmation
  returnRequest: {
    subject: 'Return Request Confirmation',
    template: 'returnRequest'
  },

  // Return status update
  returnStatus: {
    subject: 'Return Status Update',
    template: 'returnStatus'
  },

  // Refund confirmation
  refundConfirmation: {
    subject: 'Refund Processed',
    template: 'refundConfirmation'
  }
};
