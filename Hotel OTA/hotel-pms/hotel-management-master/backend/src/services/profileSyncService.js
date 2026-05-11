import User from '../models/User.js';
import UserPreference from '../models/UserPreference.js';
import GuestCRMProfile from '../models/GuestCRMProfile.js';
import logger from '../utils/logger.js';

/**
 * Syncs profile data between User, UserPreference, and GuestCRMProfile models.
 * Called after profile updates from any source.
 */
class ProfileSyncService {
  /**
   * Sync User preferences to UserPreference model
   */
  static async syncUserToPreferences(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user || user.role !== 'guest') return;

      const update = {};
      if (user.preferences) {
        if (user.preferences.bedType) update['guest.stayPreferences.bedType'] = user.preferences.bedType;
        if (user.preferences.floor) update['guest.stayPreferences.floor'] = user.preferences.floor;
        if (user.preferences.smokingAllowed !== undefined) update['guest.stayPreferences.smoking'] = user.preferences.smokingAllowed;
      }

      if (Object.keys(update).length > 0) {
        await UserPreference.findOneAndUpdate(
          { userId },
          { $set: update },
          { upsert: true }
        );
      }
    } catch (err) {
      logger.warn('ProfileSync: User->Preferences sync failed:', err.message);
    }
  }

  /**
   * Sync User profile data to GuestCRMProfile
   */
  static async syncUserToCRM(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user || user.role !== 'guest') return;

      // Split name into first/last for CRM personalInfo fields
      const nameParts = (user.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const update = {
        userId: userId,
        'personalInfo.fullName': user.name,
        'personalInfo.firstName': firstName,
        'personalInfo.lastName': lastName,
        'personalInfo.email': user.email,
        'personalInfo.phone': user.phone,
        lastUpdated: new Date()
      };

      // GuestCRMProfile requires hotelId — only sync if user has one
      if (!user.hotelId) return;

      await GuestCRMProfile.findOneAndUpdate(
        { userId: userId, hotelId: user.hotelId },
        { $set: update },
        { upsert: true }
      );
    } catch (err) {
      logger.warn('ProfileSync: User->CRM sync failed:', err.message);
    }
  }

  /**
   * Full sync — syncs User data to both UserPreference and GuestCRMProfile
   */
  static async syncAll(userId) {
    await Promise.allSettled([
      this.syncUserToPreferences(userId),
      this.syncUserToCRM(userId)
    ]);
  }

  /**
   * Sync UserPreference stay preferences back to User model
   */
  static async syncPreferencesToUser(userId) {
    try {
      const prefs = await UserPreference.findOne({ userId }).lean();
      if (!prefs?.guest?.stayPreferences) return;

      const update = {};
      const sp = prefs.guest.stayPreferences;
      if (sp.bedType) update['preferences.bedType'] = sp.bedType;
      if (sp.floor) update['preferences.floor'] = sp.floor;
      if (sp.smoking !== undefined) update['preferences.smokingAllowed'] = sp.smoking;

      if (Object.keys(update).length > 0) {
        await User.findByIdAndUpdate(userId, { $set: update });
      }
    } catch (err) {
      logger.warn('ProfileSync: Preferences->User sync failed:', err.message);
    }
  }
}

export default ProfileSyncService;
