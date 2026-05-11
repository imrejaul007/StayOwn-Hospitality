"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const channels_1 = __importDefault(require("./routes/channels"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3082;
app.use(express_1.default.json());
app.use('/api/channels', channels_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'rez-channel-manager-service' });
});
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_channel_manager';
mongoose_1.default.connect(MONGODB_URI)
    .then(() => {
    console.log('Channel Manager connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Channel Manager running on port ${PORT}`);
    });
})
    .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map