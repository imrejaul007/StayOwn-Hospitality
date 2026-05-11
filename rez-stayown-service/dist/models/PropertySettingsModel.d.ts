/**
 * Property Settings Model for StayOwn Service
 *
 * Stores property-specific settings like cancellation policies with MongoDB persistence.
 * Replaces in-memory propertyCancellationSettings Map.
 */
import mongoose, { Document } from 'mongoose';
export interface IPropertySettings extends Document {
    propertyId: string;
    freeCancellationEnabled: boolean;
    cancellationHours: number;
    refundPercentage: number;
    updatedAt: Date;
    updatedBy?: string;
}
export declare const PropertySettings: mongoose.Model<IPropertySettings, {}, {}, {}, mongoose.Document<unknown, {}, IPropertySettings, {}, mongoose.DefaultSchemaOptions> & IPropertySettings & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPropertySettings>;
//# sourceMappingURL=PropertySettingsModel.d.ts.map