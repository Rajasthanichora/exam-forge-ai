import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius } from '../lib/theme';

interface HeaderProps {
  sectionName?: string;
  onShowHistory: () => void;
  onOpenSidebar: () => void;
}

export default function Header({ sectionName, onShowHistory, onOpenSidebar }: HeaderProps) {
  const router = useRouter();
  const { colors: C } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
      <View style={styles.left}>
        <TouchableOpacity onPress={() => { onOpenSidebar(); }} style={styles.menuBtn}>
          <Ionicons name="menu-outline" size={22} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.logo}>
          <Image source={require('../assets/exam-forge-transparant.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        </View>
        <View>
          <Text style={[styles.title, { color: C.foreground }]}>ExamForge AI</Text>
          <Text style={[styles.subtitle, { color: C.mutedForeground }]}>
            {sectionName || 'Smart Test Generator'}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <TouchableOpacity onPress={() => { onShowHistory(); }} style={styles.iconBtn}>
          <Ionicons name="bar-chart-outline" size={20} color={C.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    flexShrink: 1,
  },
  menuBtn: {
    padding: Spacing.xs,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: Spacing.sm,
  },
});
