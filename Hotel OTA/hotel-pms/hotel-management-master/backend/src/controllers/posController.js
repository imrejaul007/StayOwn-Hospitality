import POSOutlet from '../models/POSOutlet.js';
import POSMenu from '../models/POSMenu.js';
import POSOrder from '../models/POSOrder.js';
import Booking from '../models/Booking.js';
import posTaxCalculationService from '../services/posTaxCalculationService.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Outlet Management
export const createOutlet = async (req, res) => {
  try {
    logger.debug('Creating outlet', { name: req.body.name });
    
    // Validate required fields
    const { name, type, location } = req.body;
    if (!name || !type || !location) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, and location are required fields'
      });
    }
    
    const outletData = {
      ...req.body,
      outletId: uuidv4()
    };
    
    logger.debug('Outlet data prepared');
    
    const outlet = new POSOutlet(outletData);
    await outlet.save();
    
    logger.debug('Outlet created', { id: outlet._id });
    
    res.status(201).json({
      success: true,
      data: outlet
    });
  } catch (error) {
    console.error('Error creating outlet:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getOutlets = async (req, res) => {
  try {
    logger.debug('Fetching outlets');
    
    const { hotelId } = req.user;
    const outlets = await POSOutlet.find({ isActive: true, hotelId })
      .populate('manager', 'name email')
      .populate('staff', 'name email role').lean().limit(1000);
    
    logger.debug('Outlets fetched', { count: outlets.length });
    
    res.json({
      success: true,
      data: outlets
    });
  } catch (error) {
    console.error('Error fetching outlets:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateOutlet = async (req, res) => {
  try {
    const { hotelId } = req.user;
    const outlet = await POSOutlet.findOneAndUpdate(
      { _id: req.params.id, hotelId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: 'Outlet not found'
      });
    }
    
    res.json({
      success: true,
      data: outlet
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Menu Management
export const createMenu = async (req, res) => {
  try {
    const menuData = {
      ...req.body,
      menuId: uuidv4()
    };
    
    const menu = new POSMenu(menuData);
    await menu.save();
    
    res.status(201).json({
      success: true,
      data: menu
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getMenusByOutlet = async (req, res) => {
  try {
    const { hotelId } = req.user;
    const menus = await POSMenu.find({
      outlet: req.params.outletId,
      isActive: true,
      hotelId
    }).populate('outlet', 'name type').lean().limit(1000);
    
    res.json({
      success: true,
      data: menus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const addMenuItem = async (req, res) => {
  try {
    const menuItem = {
      ...req.body,
      itemId: uuidv4()
    };

    const { hotelId } = req.user;
    const menu = await POSMenu.findOneAndUpdate(
      { _id: req.params.menuId, hotelId },
      { $push: { items: menuItem } },
      { new: true, runValidators: true }
    );

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    res.status(201).json({
      success: true,
      data: menuItem
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Order Management
export const createOrder = async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      orderId: uuidv4(),
      // Set default payment method for room service
      payment: req.body.payment || {
        method: req.body.type === 'room_service' ? 'room_charge' : 'cash',
        status: 'pending'
      }
    };
    
    // Calculate totals
    let subtotal = 0;
    orderData.items.forEach(item => {
      let itemTotal = item.price * item.quantity;
      if (item.modifiers) {
        item.modifiers.forEach(mod => {
          itemTotal += mod.price * item.quantity;
        });
      }
      subtotal += itemTotal;
    });
    
    orderData.subtotal = subtotal;
    
    // Calculate taxes using the new tax calculation service
    try {
      const taxResult = await posTaxCalculationService.calculateOrderTaxes(
        { items: orderData.items, subtotal },
        {
          hotelId: req.user.hotelId,
          outletId: orderData.outlet,
          customerType: orderData.customer?.guest ? 'individual' : 'walk_in',
          applyExemptions: true,
          includeBreakdown: true
        }
      );

      // Enhanced tax structure
      orderData.taxes = {
        // Legacy fields for backward compatibility
        serviceTax: taxResult.taxBreakdown.find(t => t.taxType === 'SERVICE_TAX')?.taxAmount || 0,
        gst: taxResult.taxBreakdown.find(t => t.taxType === 'GST')?.taxAmount || 0,
        otherTaxes: taxResult.totalTax - (orderData.taxes?.serviceTax || 0) - (orderData.taxes?.gst || 0),
        totalTax: taxResult.totalTax,
        
        // Enhanced tax breakdown
        breakdown: taxResult.taxBreakdown,
        exemptedAmount: taxResult.exemptedAmount,
        taxableAmount: taxResult.taxableAmount,
        calculationTimestamp: taxResult.calculationTimestamp,
        appliedTaxes: taxResult.appliedTaxes
      };
    } catch (taxError) {
      // Fallback to legacy tax calculation if new service fails
      console.warn('Tax calculation service failed, using legacy calculation:', taxError.message);
      const outlet = await POSOutlet.findOne({ _id: orderData.outlet, hotelId: req.user.hotelId }).lean();
      const serviceTax = subtotal * (outlet.taxSettings.serviceTaxRate / 100);
      const gst = subtotal * (outlet.taxSettings.gstRate / 100);
      const totalTax = serviceTax + gst;
      
      orderData.taxes = {
        serviceTax,
        gst,
        otherTaxes: 0,
        totalTax,
        breakdown: [],
        exemptedAmount: 0,
        taxableAmount: subtotal,
        calculationTimestamp: new Date(),
        appliedTaxes: []
      };
    }
    
    // Apply discounts
    let discountAmount = 0;
    if (orderData.discounts) {
      orderData.discounts.forEach(discount => {
        if (discount.percentage) {
          discountAmount += subtotal * (discount.percentage / 100);
        } else {
          discountAmount += discount.amount;
        }
      });
    }
    
    orderData.totalAmount = subtotal + orderData.taxes.totalTax - discountAmount;

    // Generate order number if not provided
    if (!orderData.orderNumber) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await POSOrder.countDocuments({
        orderNumber: new RegExp(`^${dateStr}`),
        hotelId: req.user.hotelId
      });
      orderData.orderNumber = `${dateStr}${(count + 1).toString().padStart(4, '0')}`;
    }

    const order = new POSOrder(orderData);
    await order.save();
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { outlet, status, date } = req.query;
    const { hotelId } = req.user;
    const filter = { hotelId };

    if (outlet) filter.outlet = outlet;
    if (status) {
      // Handle comma-separated status values for multiple statuses
      if (status.includes(',')) {
        filter.status = { $in: status.split(',') };
      } else {
        filter.status = status;
      }
    }
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.orderTime = { $gte: startDate, $lt: endDate };
    }
    
    const orders = await POSOrder.find(filter)
      .populate('outlet', 'name type')
      .populate('customer.guest', 'firstName lastName email')
      .populate('staff.server', 'firstName lastName')
      .populate('staff.cashier', 'firstName lastName')
      .sort({ orderTime: -1 }).lean().limit(1000);
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Build the timestamp update atomically based on the new status
    const timestampUpdate = {};
    switch (status) {
      case 'preparing':
        timestampUpdate.preparedTime = new Date();
        break;
      case 'ready':
        timestampUpdate.readyTime = new Date();
        break;
      case 'served':
        timestampUpdate.servedTime = new Date();
        break;
      case 'completed':
        timestampUpdate.completedTime = new Date();
        break;
    }

    const { hotelId } = req.user;
    const order = await POSOrder.findOneAndUpdate(
      { _id: req.params.id, hotelId },
      { $set: { status, ...timestampUpdate } },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const processPayment = async (req, res) => {
  try {
    const { paymentMethod, amount, paymentDetails } = req.body;

    // First read to compute change, then atomically update with a
    // precondition on totalAmount to prevent a concurrent modification
    // from causing an incorrect change calculation.
    const { hotelId } = req.user;
    const existingOrder = await POSOrder.findOne({ _id: req.params.id, hotelId }).select('totalAmount status').lean();

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const payment = {
      method: paymentMethod,
      status: 'paid',
      paidAmount: amount,
      paymentDetails
    };

    if (amount > existingOrder.totalAmount) {
      payment.changeGiven = amount - existingOrder.totalAmount;
    }

    // Atomic update: only succeeds if totalAmount has not been changed
    // by another concurrent request since we read it.
    const order = await POSOrder.findOneAndUpdate(
      { _id: req.params.id, hotelId, totalAmount: existingOrder.totalAmount },
      {
        $set: {
          payment,
          status: 'completed',
          completedTime: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(409).json({
        success: false,
        message: 'Order was modified by another request. Please retry.'
      });
    }

    // If room_charge, update the guest's booking folio
    if (paymentMethod === 'room_charge' && order.customer?.roomNumber) {
      try {
        const booking = await Booking.findOne({
          hotelId: req.user.hotelId,
          status: 'checked_in',
          'roomId': { $exists: true },
        }).populate('roomId', 'roomNumber').lean().then(async () => {
          // Find booking by room number
          return Booking.findOne({
            hotelId: req.user.hotelId,
            status: 'checked_in',
          }).populate('roomId', 'roomNumber');
        });

        if (booking) {
          // Add POS charge as settlement adjustment
          if (typeof booking.addSettlementAdjustment === 'function') {
            await booking.addSettlementAdjustment({
              type: 'pos_charge',
              amount: order.totalAmount,
              description: `POS Order #${order.orderNumber || order._id} - Room Charge`,
              reference: order._id.toString(),
            });
          } else {
            // Fallback: update totalAmount on booking
            await Booking.findByIdAndUpdate(booking._id, {
              $inc: { totalAmount: order.totalAmount },
              $push: {
                statusHistory: {
                  status: booking.status,
                  changedAt: new Date(),
                  note: `POS charge added: ₹${order.totalAmount} (Order #${order.orderNumber || order._id})`,
                }
              }
            });
          }
          logger.info('POS room charge added to booking', {
            bookingId: booking._id,
            orderId: order._id,
            amount: order.totalAmount,
          });
        }
      } catch (folioError) {
        // Don't fail the POS payment — log the folio error for manual reconciliation
        logger.error('Failed to add POS charge to booking folio', {
          orderId: order._id,
          error: folioError.message,
        });
      }
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Dashboard Stats
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const { hotelId } = req.user;

    // Today's completed orders
    const completedOrders = await POSOrder.find({
      status: 'completed',
      completedTime: { $gte: startOfDay, $lt: endOfDay },
      hotelId
    }).lean().limit(1000);

    // Active orders
    const activeOrders = await POSOrder.countDocuments({
      status: { $in: ['preparing', 'ready'] },
      hotelId
    });

    // Calculate stats
    const todaysSales = completedOrders.reduce((total, order) => total + order.totalAmount, 0);
    const todaysOrders = completedOrders.length;
    const averageOrderValue = todaysOrders > 0 ? todaysSales / todaysOrders : 0;

    res.json({
      success: true,
      data: {
        todaysSales,
        todaysOrders,
        activeOrders,
        averageOrderValue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reporting
// Calculate order totals with tax
export const calculateOrderTotals = async (req, res) => {
  try {
    const { items, outletId, discounts = [] } = req.body;

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    // Get outlet for tax settings
    const { hotelId } = req.user;
    let outlet;
    if (outletId) {
      outlet = await POSOutlet.findOne({ _id: outletId, hotelId }).lean();
    }

    // Default tax rates if outlet not found
    const taxSettings = outlet?.taxSettings || {
      defaultTaxRate: 18,
      serviceTaxRate: 10,
      gstRate: 18
    };

    // Calculate item totals
    let subtotal = 0;
    const calculatedItems = items.map(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      return {
        ...item,
        total: itemTotal
      };
    });

    // Calculate discounts
    let totalDiscount = 0;
    discounts.forEach(discount => {
      if (discount.type === 'percentage') {
        totalDiscount += (subtotal * discount.value) / 100;
      } else {
        totalDiscount += discount.value;
      }
    });

    // Calculate taxes on discounted amount
    const taxableAmount = subtotal - totalDiscount;
    const gstAmount = (taxableAmount * taxSettings.gstRate) / 100;
    const serviceTax = (taxableAmount * taxSettings.serviceTaxRate) / 100;
    const totalTax = gstAmount + serviceTax;

    // Calculate final total
    const grandTotal = taxableAmount + totalTax;

    res.json({
      success: true,
      data: {
        items: calculatedItems,
        subtotal,
        totalDiscount,
        taxableAmount,
        taxes: {
          gstRate: taxSettings.gstRate,
          gstAmount,
          serviceTaxRate: taxSettings.serviceTaxRate,
          serviceTax,
          totalTax
        },
        grandTotal
      }
    });
  } catch (error) {
    console.error('Error calculating order totals:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Calculate billing session totals
export const calculateBillingTotals = async (req, res) => {
  try {
    const { session, splitPayments = [] } = req.body;

    if (!session || !session.items) {
      return res.status(400).json({
        success: false,
        message: 'Session with items is required'
      });
    }

    // Calculate subtotal from items
    const subtotal = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate item taxes
    const totalItemTax = session.items.reduce((sum, item) => sum + ((item.tax || 0) * item.quantity), 0);

    // Apply discounts
    const totalDiscount = session.totalDiscount || 0;
    const taxableAmount = subtotal - totalDiscount;

    // Calculate grand total
    const grandTotal = taxableAmount + totalItemTax;

    // Calculate split payment totals
    const totalSplitAmount = splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingAmount = grandTotal - totalSplitAmount;

    res.json({
      success: true,
      data: {
        subtotal,
        totalDiscount,
        taxableAmount,
        totalItemTax,
        grandTotal,
        splitPayments: {
          totalSplitAmount,
          remainingAmount,
          payments: splitPayments
        }
      }
    });
  } catch (error) {
    console.error('Error calculating billing totals:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { outlet, startDate, endDate } = req.query;
    const { hotelId } = req.user;
    const matchStage = {
      status: 'completed',
      'payment.status': 'paid',
      hotelId: new mongoose.Types.ObjectId(hotelId)
    };

    if (outlet) matchStage.outlet = new mongoose.Types.ObjectId(outlet);
    if (startDate && endDate) {
      matchStage.completedTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const salesData = await POSOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            outlet: '$outlet',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$completedTime' } }
          },
          totalSales: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
          totalTax: { $sum: '$taxes.totalTax' }
        }
      },
      {
        $lookup: {
          from: 'posoutlets',
          localField: '_id.outlet',
          foreignField: '_id',
          as: 'outlet'
        }
      }
    ]);
    
    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  createOutlet,
  getOutlets,
  updateOutlet,
  createMenu,
  getMenusByOutlet,
  addMenuItem,
  createOrder,
  getOrders,
  updateOrderStatus,
  processPayment,
  getDashboardStats,
  getSalesReport,
  calculateOrderTotals,
  calculateBillingTotals
};
