const Order = require('../models/Order');
const Product = require('../models/Product');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require('../utils/email');

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      couponCode
    } = req.body;

    // Validate products and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          status: 'error',
          message: `Product ${item.product} not found`
        });
      }

      // Check stock
      const variant = product.variants.find(
        v => v.size === item.variant.size && v.color === item.variant.color
      );
      if (!variant || variant.stock < item.quantity) {
        return res.status(400).json({
          status: 'error',
          message: `Insufficient stock for product ${product.name}`
        });
      }

      // Add to order items
      orderItems.push({
        product: product._id,
        variant: item.variant,
        quantity: item.quantity,
        price: product.price
      });

      subtotal += product.price * item.quantity;
    }

    // Calculate tax and shipping
    const tax = subtotal * 0.18; // 18% GST
    const shippingCost = subtotal > 1000 ? 0 : 100; // Free shipping over ₹1000

    // Apply coupon if provided
    let discount = 0;
    if (couponCode) {
      // Implement coupon logic here
    }

    // Create order
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      billingAddress,
      paymentInfo: {
        method: paymentMethod
      },
      subtotal,
      tax,
      shippingCost,
      discount,
      total: subtotal + tax + shippingCost - discount,
      couponCode
    });

    // Handle payment
    if (paymentMethod === 'card') {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100), // Convert to smallest currency unit
        currency: 'inr',
        metadata: {
          orderId: order._id.toString()
        }
      });

      order.paymentInfo.clientSecret = paymentIntent.client_secret;
    }

    await order.save();

    // Update product stock
    for (const item of orderItems) {
      await Product.findOneAndUpdate(
        {
          _id: item.product,
          'variants.size': item.variant.size,
          'variants.color': item.variant.color
        },
        {
          $inc: { 'variants.$.stock': -item.quantity }
        }
      );
    }

    // Send order confirmation email
    await sendEmail({
      to: req.user.email,
      subject: 'Order Confirmation',
      template: 'orderConfirmation',
      context: {
        order,
        user: req.user
      }
    });

    res.status(201).json({
      status: 'success',
      data: { 
        order,
        clientSecret: order.paymentInfo.clientSecret
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get user orders
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name images')
      .sort('-createdAt');

    res.json({
      status: 'success',
      data: { orders }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get single order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images price')
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    // Check if user is authorized to view this order
    if (order.user._id.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      status: 'success',
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    // Only admin or seller can update order status
    if (req.user.role !== 'admin' && req.user.role !== 'seller') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update order status'
      });
    }

    order.status = status;
    await order.save();

    // Send status update email
    await sendEmail({
      to: order.user.email,
      subject: 'Order Status Update',
      template: 'orderStatus',
      context: {
        order,
        status
      }
    });

    res.json({
      status: 'success',
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Order cannot be cancelled at this stage'
      });
    }

    // Update order status
    order.status = 'cancelled';
    order.cancelReason = reason;
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findOneAndUpdate(
        {
          _id: item.product,
          'variants.size': item.variant.size,
          'variants.color': item.variant.color
        },
        {
          $inc: { 'variants.$.stock': item.quantity }
        }
      );
    }

    // Process refund if payment was made
    if (order.paymentInfo.status === 'paid') {
      // Implement refund logic here
    }

    // Send cancellation email
    await sendEmail({
      to: order.user.email,
      subject: 'Order Cancelled',
      template: 'orderCancellation',
      context: {
        order,
        reason
      }
    });

    res.json({
      status: 'success',
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
