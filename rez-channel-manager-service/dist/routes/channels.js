"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ChannelManager_1 = require("../models/ChannelManager");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Connect channel
router.post('/connect', (0, auth_1.requireRole)('hotel_admin', 'super_admin'), async (req, res) => {
    try {
        const { hotelId, otaType, credentials, settings } = req.body;
        // Check if already connected
        const existing = await ChannelManager_1.Channel.findOne({ hotelId, otaType });
        if (existing) {
            return res.status(400).json({
                error: 'Channel already connected'
            });
        }
        const channel = new ChannelManager_1.Channel({
            hotelId,
            otaType,
            credentials,
            settings: settings || {
                inventorySync: true,
                priceSync: true,
                bookingSync: true,
                autoConfirm: true,
                commissionRate: 15,
                markupRate: 0
            },
            status: 'connected'
        });
        await channel.save();
        res.status(201).json({
            channelId: channel._id,
            otaType: channel.otaType,
            status: channel.status,
            message: `${otaType} connected successfully`
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Sync inventory
router.post('/sync/:channelId', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const { channelId } = req.params;
        // Validate ObjectId format to prevent information leakage
        if (!mongoose.Types.ObjectId.isValid(channelId)) {
            return res.status(400).json({ error: 'Invalid channel ID format' });
        }
        const channel = await ChannelManager_1.Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        channel.status = 'syncing';
        await channel.save();
        // Get inventory for next 30 days
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        const inventory = await ChannelManager_1.Inventory.find({
            hotelId: channel.hotelId,
            date: { $gte: startDate, $lte: endDate }
        });
        // In production, sync with OTA API
        // Simulate sync
        for (const inv of inventory) {
            inv.synced = true;
            inv.syncedAt = new Date();
            inv.syncedChannels.push(channel.otaType);
            await inv.save();
        }
        channel.lastSync = new Date();
        channel.status = 'connected';
        channel.lastError = undefined;
        await channel.save();
        res.json({
            success: true,
            syncedItems: inventory.length,
            lastSync: channel.lastSync
        });
    }
    catch (error) {
        const channel = await ChannelManager_1.Channel.findById(req.params.channelId);
        if (channel) {
            channel.status = 'error';
            channel.lastError = error.message;
            await channel.save();
        }
        res.status(400).json({ error: error.message });
    }
});
// Get channel status
router.get('/status/:hotelId', async (req, res) => {
    try {
        const channels = await ChannelManager_1.Channel.find({ hotelId: req.params.hotelId });
        res.json({
            channels: channels.map(ch => ({
                channelId: ch._id,
                otaType: ch.otaType,
                status: ch.status,
                lastSync: ch.lastSync,
                lastError: ch.lastError,
                enabled: ch.enabled
            }))
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update inventory
router.post('/inventory', async (req, res) => {
    try {
        const { hotelId, roomTypeId, date, totalRooms, availableRooms } = req.body;
        const inventory = await ChannelManager_1.Inventory.findOneAndUpdate({ hotelId, roomTypeId, date }, {
            hotelId,
            roomTypeId,
            date,
            totalRooms,
            availableRooms,
            blockedRooms: totalRooms - availableRooms,
            synced: false
        }, { upsert: true, new: true });
        res.json({
            inventoryId: inventory._id,
            synced: false
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get bookings from channels
router.get('/bookings/:hotelId', async (req, res) => {
    try {
        const { startDate, endDate, channel } = req.query;
        const query = { hotelId: req.params.hotelId };
        if (startDate && endDate) {
            query.checkIn = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (channel) {
            query.channelType = channel;
        }
        const bookings = await ChannelManager_1.ChannelBooking.find(query).sort({ checkIn: -1 });
        res.json({
            bookings: bookings.map(b => ({
                bookingId: b._id,
                channelType: b.channelType,
                guestName: b.guestName,
                checkIn: b.checkIn,
                checkOut: b.checkOut,
                rooms: b.rooms,
                totalAmount: b.totalAmount,
                commission: b.commission,
                netAmount: b.netAmount,
                status: b.status
            }))
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Confirm booking from OTA
router.post('/booking/confirm', async (req, res) => {
    try {
        const { hotelId, channelBookingId, channelType, guestName, guestEmail, guestPhone, checkIn, checkOut, roomType, rooms, totalAmount, guestRequests } = req.body;
        // Calculate commission
        const channel = await ChannelManager_1.Channel.findOne({ hotelId, otaType: channelType });
        const commissionRate = channel?.settings.commissionRate || 15;
        const commission = Math.ceil(totalAmount * commissionRate / 100);
        const netAmount = totalAmount - commission;
        const booking = new ChannelManager_1.ChannelBooking({
            hotelId,
            channelBookingId,
            channelType,
            guestName,
            guestEmail,
            guestPhone,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            roomType,
            rooms,
            totalAmount,
            commission,
            netAmount,
            guestRequests,
            source: channelType,
            status: 'confirmed'
        });
        await booking.save();
        res.status(201).json({
            bookingId: booking._id,
            status: 'confirmed',
            commission,
            netAmount
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Pricing plans
router.get('/pricing', (req, res) => {
    res.json({
        plans: [
            {
                name: 'Basic',
                price: 999,
                period: 'month',
                channels: 2,
                features: ['Inventory sync', 'Booking sync', 'Email support']
            },
            {
                name: 'Pro',
                price: 2499,
                period: 'month',
                channels: 5,
                features: ['All Basic features', 'Price sync', 'Auto-confirm', 'Priority support']
            },
            {
                name: 'Enterprise',
                price: 4999,
                period: 'month',
                channels: -1, // unlimited
                features: ['All Pro features', 'Unlimited channels', 'Custom integration', 'Dedicated support']
            }
        ]
    });
});
exports.default = router;
//# sourceMappingURL=channels.js.map