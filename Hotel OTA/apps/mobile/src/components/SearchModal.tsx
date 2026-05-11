import React, { useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet from './BottomSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SearchParams {
  city: string;
  checkin: string;
  checkout: string;
  rooms: number;
  guests: number;
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (params: SearchParams) => void;
}

// ---- helpers ----
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// Build 2-month grid: returns array of { monthLabel, weeks }
function buildCalendarMonths(baseDate: Date) {
  const months = [];
  for (let mi = 0; mi < 2; mi++) {
    const first = new Date(baseDate.getFullYear(), baseDate.getMonth() + mi, 1);
    const label = first.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    // pad start
    const days: (Date | null)[] = [];
    const startDow = first.getDay(); // 0=Sun
    for (let i = 0; i < startDow; i++) days.push(null);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(first.getFullYear(), first.getMonth(), d));
    }
    // chunk into weeks
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    months.push({ label, weeks });
  }
  return months;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type CalendarTarget = 'checkin' | 'checkout' | null;

export default function SearchModal({ visible, onClose, onSearch }: SearchModalProps) {
  const today = new Date();
  const [checkin, setCheckin] = useState(toDateStr(addDays(today, 1)));
  const [checkout, setCheckout] = useState(toDateStr(addDays(today, 2)));
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>(null);

  const baseMonth = today;
  const calMonths = buildCalendarMonths(baseMonth);

  function handleDayPress(d: Date) {
    const iso = toDateStr(d);
    if (calendarTarget === 'checkin') {
      setCheckin(iso);
      // auto-advance checkout if needed
      if (iso >= checkout) {
        setCheckout(toDateStr(addDays(d, 1)));
      }
      setCalendarTarget('checkout');
    } else if (calendarTarget === 'checkout') {
      if (iso <= checkin) {
        // treat as new checkin
        setCheckin(iso);
        setCheckout(toDateStr(addDays(d, 1)));
      } else {
        setCheckout(iso);
      }
      setCalendarTarget(null);
    }
  }

  function getDayStyle(iso: string) {
    if (iso === checkin) return styles.dayCheckin;
    if (iso === checkout) return styles.dayCheckout;
    if (iso > checkin && iso < checkout) return styles.dayRange;
    return null;
  }

  function getDayTextStyle(iso: string) {
    if (iso === checkin || iso === checkout) return styles.dayTextSelected;
    if (iso > checkin && iso < checkout) return styles.dayTextRange;
    return null;
  }

  function handleSearch() {
    onSearch({ city: 'Bangalore', checkin, checkout, rooms, guests });
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} height={SCREEN_HEIGHT * 0.85}>
      <Text style={styles.sheetTitle}>Search Hotels</Text>

      {/* City */}
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>City</Text>
        <View style={styles.cityBox}>
          <Text style={styles.cityIcon}>📍</Text>
          <Text style={styles.cityText}>Bangalore</Text>
        </View>
      </View>

      {/* Date buttons */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={[styles.dateBtn, calendarTarget === 'checkin' && styles.dateBtnActive]}
          onPress={() => setCalendarTarget(calendarTarget === 'checkin' ? null : 'checkin')}
        >
          <Text style={styles.dateBtnLabel}>Check-in</Text>
          <Text style={styles.dateBtnValue}>{formatDisplay(checkin)}</Text>
        </TouchableOpacity>
        <View style={styles.dateSeparator} />
        <TouchableOpacity
          style={[styles.dateBtn, calendarTarget === 'checkout' && styles.dateBtnActive]}
          onPress={() => setCalendarTarget(calendarTarget === 'checkout' ? null : 'checkout')}
        >
          <Text style={styles.dateBtnLabel}>Check-out</Text>
          <Text style={styles.dateBtnValue}>{formatDisplay(checkout)}</Text>
        </TouchableOpacity>
      </View>

      {/* Inline Calendar */}
      {calendarTarget !== null && (
        <View style={styles.calendarBox}>
          <View style={styles.calDayLabels}>
            {DAY_LABELS.map((l) => (
              <Text key={l} style={styles.calDayLabel}>{l}</Text>
            ))}
          </View>
          {calMonths.map((month) => (
            <View key={month.label} style={styles.calMonth}>
              <Text style={styles.calMonthLabel}>{month.label}</Text>
              {month.weeks.map((week, wi) => (
                <View key={wi} style={styles.calWeek}>
                  {week.map((day, di) => {
                    if (!day) {
                      return <View key={di} style={styles.calDayCell} />;
                    }
                    const iso = toDateStr(day);
                    const isPast = day < today;
                    return (
                      <TouchableOpacity
                        key={di}
                        style={[styles.calDayCell, getDayStyle(iso), isPast && styles.calDayPast]}
                        onPress={() => !isPast && handleDayPress(day)}
                        activeOpacity={isPast ? 1 : 0.7}
                      >
                        <Text style={[styles.calDayText, getDayTextStyle(iso), isPast && styles.calDayTextPast]}>
                          {day.getDate()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Rooms stepper */}
      <View style={styles.stepperRow}>
        <View>
          <Text style={styles.stepperLabel}>Rooms</Text>
          <Text style={styles.stepperSub}>Max 5</Text>
        </View>
        <View style={styles.stepperControl}>
          <TouchableOpacity
            style={[styles.stepBtn, rooms <= 1 && styles.stepBtnDisabled]}
            onPress={() => setRooms(Math.max(1, rooms - 1))}
          >
            <Text style={styles.stepBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{rooms}</Text>
          <TouchableOpacity
            style={[styles.stepBtn, rooms >= 5 && styles.stepBtnDisabled]}
            onPress={() => setRooms(Math.min(5, rooms + 1))}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Guests stepper */}
      <View style={styles.stepperRow}>
        <View>
          <Text style={styles.stepperLabel}>Guests</Text>
          <Text style={styles.stepperSub}>Max 10</Text>
        </View>
        <View style={styles.stepperControl}>
          <TouchableOpacity
            style={[styles.stepBtn, guests <= 1 && styles.stepBtnDisabled]}
            onPress={() => setGuests(Math.max(1, guests - 1))}
          >
            <Text style={styles.stepBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{guests}</Text>
          <TouchableOpacity
            style={[styles.stepBtn, guests >= 10 && styles.stepBtnDisabled]}
            onPress={() => setGuests(Math.min(10, guests + 1))}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search button */}
      <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
        <Text style={styles.searchBtnText}>Search Hotels</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
    marginTop: 8,
  },
  fieldRow: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cityIcon: { fontSize: 16, marginRight: 8 },
  cityText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dateBtn: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateBtnActive: { backgroundColor: '#dbeafe' },
  dateBtnLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateBtnValue: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  dateSeparator: { width: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },

  // Calendar
  calendarBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calDayLabels: { flexDirection: 'row', marginBottom: 4 },
  calDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  calMonth: { marginBottom: 16 },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  calWeek: { flexDirection: 'row' },
  calDayCell: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 8 },
  calDayText: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  calDayPast: { opacity: 0.35 },
  calDayTextPast: { color: '#94a3b8' },
  dayCheckin: { backgroundColor: '#2563eb', borderRadius: 8 },
  dayCheckout: { backgroundColor: '#2563eb', borderRadius: 8 },
  dayRange: { backgroundColor: '#dbeafe', borderRadius: 0 },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextRange: { color: '#2563eb', fontWeight: '600' },

  // Steppers
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepperLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  stepperSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  stepperControl: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnDisabled: { backgroundColor: '#e2e8f0' },
  stepBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  stepValue: { fontSize: 18, fontWeight: '700', color: '#1e293b', minWidth: 24, textAlign: 'center' },

  searchBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
