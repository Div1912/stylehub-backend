const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const { emailTemplates } = require('../utils/email');

exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount } = req.body;

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'inr',
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

exports.handlePaymentSuccess = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    // Verify the payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment not successful');
    }

    // Update order status
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = 'paid';
    order.paymentStatus = 'completed';
    order.paymentDetails = {
      paymentIntentId,
      paymentMethod: paymentIntent.payment_method,
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency,
      paidAt: new Date(),
    };

    await order.save();

    // Send confirmation email
    const user = await User.findById(order.user);
    await sendEmail({
      to: user.email,
      subject: emailTemplates.orderConfirmation.subject,
      template: emailTemplates.orderConfirmation.template,
      context: {
        name: user.name,
        orderNumber: order._id,
        orderDate: order.createdAt,
        items: order.items,
        shippingAddress: order.shippingAddress,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        total: order.total,
        trackingLink: `${process.env.FRONTEND_URL}/orders/${order._id}`,
        year: new Date().getFullYear(),
      },
    });

    // Notify seller
    if (order.seller) {
      await sendEmail({
        to: order.seller.email,
        subject: 'New Order Received',
        template: 'newOrder',
        context: {
          sellerName: order.seller.name,
          orderNumber: order._id,
          orderDate: order.createdAt,
          items: order.items,
          total: order.total,
        },
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

exports.handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, error } = req.body;

    // Update order status
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = 'payment_failed';
    order.paymentStatus = 'failed';
    order.paymentDetails = {
      error: error.message,
      failedAt: new Date(),
    };

    await order.save();

    // Send failure notification email
    const user = await User.findById(order.user);
    await sendEmail({
      to: user.email,
      subject: 'Payment Failed',
      template: 'paymentFailed',
      context: {
        name: user.name,
        orderNumber: order._id,
        errorMessage: error.message,
        retryLink: `${process.env.FRONTEND_URL}/checkout/${order._id}`,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

exports.handleRefund = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentDetails.paymentIntentId,
      reason: reason,
    });

    // Update order status
    order.status = 'refunded';
    order.paymentStatus = 'refunded';
    order.paymentDetails.refund = {
      refundId: refund.id,
      amount: refund.amount / 100,
      reason: reason,
      refundedAt: new Date(),
    };

    await order.save();

    // Send refund confirmation email
    const user = await User.findById(order.user);
    await sendEmail({
      to: user.email,
      subject: emailTemplates.refundConfirmation.subject,
      template: emailTemplates.refundConfirmation.template,
      context: {
        name: user.name,
        orderNumber: order._id,
        refundAmount: order.paymentDetails.refund.amount,
        reason: reason,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        order,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};
