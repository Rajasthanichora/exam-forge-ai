import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Alert, Image
} from 'react-native';
import { Group, Section } from '../lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { useRouter } from 'expo-router';

interface SectionSidebarProps {
  groups: Group[];
  sections: Section[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onCreateSection: (name: string, groupId: string) => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onCreateGroup: (name: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SectionSidebar({
  groups, sections, activeSectionId, onSelectSection,
  onCreateSection, onRenameSection, onDeleteSection,
  onCreateGroup, onRenameGroup, onDeleteGroup,
  isOpen, onClose,
}: SectionSidebarProps) {
  const { colors: C } = useTheme();
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingSectionIn, setCreatingSectionIn] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState('');

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName('');
      setCreatingGroup(false);
    }
  };

  const handleCreateSection = (groupId: string) => {
    if (newSectionName.trim()) {
      onCreateSection(newSectionName.trim(), groupId);
      setNewSectionName('');
      setCreatingSectionIn(null);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal animationType="slide" transparent visible={isOpen} onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.container, { backgroundColor: C.card, borderRightColor: C.border }]}>
          {/* Header with logo */}
          <View style={[styles.header, { borderBottomColor: C.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={styles.logo}>
                <Image source={require('../assets/exam-forge-transparant.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
              </View>
              <Text style={[styles.title, { color: C.foreground }]}>ExamForge AI</Text>
            </View>
            <TouchableOpacity onPress={() => { onClose(); }} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={C.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Add New Group */}
          <View style={styles.addGroupRow}>
            {creatingGroup ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[styles.editInput, { backgroundColor: C.muted, color: C.foreground }]}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Group name..."
                  placeholderTextColor={C.mutedForeground}
                  autoFocus
                  onSubmitEditing={handleCreateGroup}
                />
                <TouchableOpacity onPress={handleCreateGroup}>
                  <Ionicons name="checkmark" size={18} color={C.primary} style={{padding: 4}} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setCreatingGroup(false); setNewGroupName(''); }}>
                  <Ionicons name="close" size={16} color={C.mutedForeground} style={{padding: 4}} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.addGroupBtn, { backgroundColor: C.primary + '10', borderColor: C.primary + '20' }]}
                onPress={() => { setCreatingGroup(true); }}>
                <Ionicons name="add" size={16} color={C.primary} />
                <Text style={[styles.addGroupText, { color: C.primary }]}>  Add New Group</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Navigation */}
          <ScrollView style={styles.nav} contentContainerStyle={{ paddingBottom: Spacing.lg }}>
            {/* Groups & Sections */}
            <Text style={[styles.navSection, { color: C.mutedForeground, marginTop: Spacing.sm }]}>Groups</Text>
            {groups.map(group => {
              const groupSections = sections.filter(s => s.groupId === group.id);
              const isExpanded = expandedGroups[group.id] === true;

              return (
                <View key={group.id} style={styles.groupContainer}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(group.id)}
                  >
                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={12} color={C.mutedForeground} />
                    {editingGroupId === group.id ? (
                      <View style={styles.editRow}>
                        <TextInput
                          style={[styles.editInput, { backgroundColor: C.muted, color: C.foreground }]}
                          value={editGroupName}
                          onChangeText={setEditGroupName}
                          autoFocus
                          onSubmitEditing={() => {
                            if (editGroupName.trim()) { onRenameGroup(group.id, editGroupName.trim()); setEditingGroupId(null); }
                          }}
                        />
                        <TouchableOpacity onPress={() => setEditingGroupId(null)}>
                          <Ionicons name="close" size={14} color={C.mutedForeground} style={{padding: 4}} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <Ionicons name="folder-outline" size={16} color={C.foreground} />
                        <Text style={[styles.groupName, { color: C.foreground }]}>{group.name}</Text>
                        <Text style={[styles.count, { color: C.mutedForeground }]}>{groupSections.length}</Text>
                        <TouchableOpacity onPress={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}>
                          <Ionicons name="pencil-outline" size={14} color={C.mutedForeground} style={{padding: 4}} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                          Alert.alert('Delete Group?', `This will permanently delete "${group.name}" and ALL sections, documents, and test history.`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => onDeleteGroup(group.id) },
                          ]);
                        }}>
                          <Ionicons name="trash-outline" size={14} color={C.mutedForeground} style={{padding: 4}} />
                        </TouchableOpacity>
                      </>
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.sectionsContainer, { borderLeftColor: C.border }]}>
                      {groupSections.map(section => (
                        <View key={section.id}>
                          {editingSectionId === section.id ? (
                            <View style={styles.editRow}>
                              <TextInput
                                style={[styles.editInput, { marginLeft: Spacing.xxl, backgroundColor: C.muted, color: C.foreground }]}
                                value={editSectionName}
                                onChangeText={setEditSectionName}
                                autoFocus
                                onSubmitEditing={() => {
                                  if (editSectionName.trim()) { onRenameSection(section.id, editSectionName.trim()); setEditingSectionId(null); }
                                }}
                              />
                              <TouchableOpacity onPress={() => setEditingSectionId(null)}>
                                <Text style={{ fontSize: 16, color: C.mutedForeground, padding: 4 }}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.sectionItem, activeSectionId === section.id && { backgroundColor: C.primary + '15', borderColor: C.primary + '25' } as any]}
                              onPress={() => { onSelectSection(section.id); }}
                            >
                              <Ionicons name="document-text-outline" size={14} color={activeSectionId === section.id ? C.primary : C.mutedForeground} />
                              <Text style={[styles.sectionName, { color: activeSectionId === section.id ? C.primary : C.foreground },
                                activeSectionId === section.id && { fontWeight: '600' }]} numberOfLines={1}>
                                {section.name}
                              </Text>
                              <TouchableOpacity onPress={() => { setEditingSectionId(section.id); setEditSectionName(section.name); }}>
                                <Ionicons name="pencil-outline" size={12} color={C.mutedForeground} style={{padding: 4}} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => {
                                Alert.alert('Delete Section?', `Delete "${section.name}"?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delete', style: 'destructive', onPress: () => onDeleteSection(section.id) },
                                ]);
                              }}>
                                <Ionicons name="trash-outline" size={12} color={C.mutedForeground} style={{padding: 4}} />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}

                      {creatingSectionIn === group.id ? (
                        <View style={[styles.editRow, { marginLeft: Spacing.xxl }]}>
                          <TextInput
                            style={[styles.editInput, { backgroundColor: C.muted, color: C.foreground }]}
                            value={newSectionName}
                            onChangeText={setNewSectionName}
                            placeholder="Section name..."
                            placeholderTextColor={C.mutedForeground}
                            autoFocus
                            onSubmitEditing={() => handleCreateSection(group.id)}
                          />
                          <TouchableOpacity onPress={() => handleCreateSection(group.id)}>
                            <Ionicons name="checkmark" size={18} color={C.primary} style={{padding: 4}} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { setCreatingSectionIn(null); setNewSectionName(''); }}>
                            <Ionicons name="close" size={14} color={C.mutedForeground} style={{padding: 4}} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.newSectionBtn} onPress={() => setCreatingSectionIn(group.id)}>
                          <Text style={[styles.plusText, { color: C.mutedForeground }]}>+ New Section</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* User Profile */}
          <View style={[styles.footer, { borderTopColor: C.border }]}>
            <TouchableOpacity
              style={[styles.aiNavBtn, { backgroundColor: C.primary + '12', borderColor: C.primary + '25' }]}
              onPress={() => { onClose(); router.push('/ai-chat'); }}
            >
              <Ionicons name="sparkles" size={16} color={C.primary} />
              <Text style={[styles.aiNavText, { color: C.primary }]}>  AI Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileCard, { backgroundColor: C.muted + '30', borderColor: C.border + '50' }]}
              onPress={() => { onClose(); router.push('/settings'); }}
            >
              <View style={[styles.avatar, { borderColor: C.border }]}>
                <Ionicons name="person" size={20} color={C.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: C.foreground }]}>Alex Rivera</Text>
                <Text style={[styles.profilePlan, { color: C.mutedForeground }]}>Pro Plan</Text>
              </View>
              <Ionicons name="settings-outline" size={18} color={C.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </Modal>
    );
  }

  const styles = StyleSheet.create({
  overlay: { flex: 1 },
  container: { width: '85%', maxWidth: 360, height: '100%', borderRightWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1 },
  logo: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.lg, fontWeight: 'bold' },
  closeBtn: { padding: Spacing.xs },
  addGroupRow: { padding: Spacing.md },
  addGroupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1 },
  addGroupText: { fontSize: FontSize.sm, fontWeight: '500' },
  nav: { flex: 1, paddingHorizontal: Spacing.sm },
  navSection: { fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm },
  navItemText: { fontSize: FontSize.sm },
  groupContainer: { marginBottom: 2 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.sm, gap: Spacing.xs },
  groupName: { flex: 1, fontSize: FontSize.md, fontWeight: '500' },
  count: { fontSize: FontSize.xs, marginRight: Spacing.xs },
  sectionsContainer: { marginLeft: Spacing.lg, paddingLeft: Spacing.sm, borderLeftWidth: 1, marginBottom: Spacing.xs },
  sectionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, gap: Spacing.xs },
  sectionName: { flex: 1, fontSize: FontSize.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.xs },
  editInput: { flex: 1, height: 34, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, fontSize: FontSize.sm },
  newSectionBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  plusText: { fontSize: FontSize.sm },
  footer: { padding: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  aiNavBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.xs,
  },
  aiNavText: { fontSize: FontSize.sm, fontWeight: '600' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, flexWrap: 'wrap' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: FontSize.sm, fontWeight: '500' },
  profilePlan: { fontSize: FontSize.xs },
});
