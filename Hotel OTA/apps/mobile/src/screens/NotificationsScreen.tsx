import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface NotifSetting {
  key: string;
  label: string;
  description: string;
  locked: boolean;
}

const SETTINGS: NotifSetting[] = [
  {
    key: 'bookingUpdates',
    label: 'Booking Updates',
    description: 'Confirmations, cancellations, reminders',
    locked: true,
  },
  {
    key: 'coinAlerts',
    label: 'Coin Alerts',
    description: 'Earned, used, and expiry warnings',
    locked: false,
  },
  {
    key: 'deals',
    label: 'Deals & Offers',
    description: 'Exclusive hotel deals and promotions',
    locked: false,
  },
  {
    key: 'rezPromotions',
    label: 'ReZ Promotions',
    description: 'Loyalty rewards and special campaigns',
    locked: false,
  },
];

type ToggleState = Record<string, boolean>;

export default function NotificationsScreen() {
  const [toggles, setToggles] = useState<ToggleState>({
    bookingUpdates: true,
    coinAlerts: true,
    deals: true,
    rezPromotions: false,
  });

  const allOptional = SETTINGS.filter((s) => !s.locked).map((s) => s.key);
  const masterOn = allOptional.every((k) => toggles[k]);

  function handleToggle(key: string, value: boolean) {
    setToggles((prev) => ({ ...prev, [key]: value }));
  }

  function handleMasterToggle(value: boolean) {
    const updates: ToggleState = {};
    allOptional.forEach((k) => { updates[k] = value; });
    setToggles((prev) => ({ ...prev, ...updates }));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Notifications</Text>

      <View style={styles.card}>
        {SETTINGS.map((setting, index) => (
          <View
            key={setting.key}
            style={[
              styles.settingRow,
              index < SETTINGS.length - 1 && styles.settingRowBorder,
            ]}
          >
            <View style={styles.settingText}>
              <View style={styles.settingLabelRow}>
                <Text style={styles.settingLabel}>{setting.label}</Text>
                {setting.locked && (
                  <View style={styles.lockedBadge}>
                    <Text style={styles.lockedBadgeText}>Always On</Text>
                  </View>
                )}
              </View>
              <Text style={styles.settingDesc}>{setting.description}</Text>
            </View>
            <Switch
              value={toggles[setting.key] ?? false}
              onValueChange={(val) => !setting.locked && handleToggle(setting.key, val)}
              disabled={setting.locked}
              trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
              thumbColor={toggles[setting.key] ? '#2563eb' : '#94a3b8'}
            />
          </View>
        ))}
      </View>

      {/* Master Toggle */}
      <View style={styles.masterCard}>
        <View style={styles.settingText}>
          <Text style={styles.masterLabel}>All Notifications</Text>
          <Text style={styles.settingDesc}>Toggle all optional notifications at once</Text>
        </View>
        <Switch
          value={masterOn}
          onValueChange={handleMasterToggle}
          trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
          thumbColor={masterOn ? '#2563eb' : '#94a3b8'}
        />
      </View>

      <Text style={styles.footerNote}>
        Booking Update notifications are required for service and cannot be disabled.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  settingText: { flex: 1, paddingRight: 12 },
  settingLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  settingDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  lockedBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lockedBadgeText: { fontSize: 10, fontWeight: '600', color: '#64748b' },

  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  masterLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },

  footerNote: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
});
