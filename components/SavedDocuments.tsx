import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavedDocument, UploadedFile } from '../lib/types';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { formatFileSize } from '../lib/utils';
import FileUpload from './FileUpload';

interface SavedDocumentsProps {
  savedDocuments: SavedDocument[];
  selectedDocIds: string[];
  onSaveDocument: (doc: { name: string; content: string; size: number }) => void;
  onRemoveDocument: (docId: string) => void;
  onSelectDocuments: (docs: SavedDocument[]) => void;
}

export default function SavedDocuments({
  savedDocuments, selectedDocIds, onSaveDocument, onRemoveDocument, onSelectDocuments,
}: SavedDocumentsProps) {
  const { colors: C } = useTheme();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([]);
  const [previewDoc, setPreviewDoc] = useState<SavedDocument | null>(null);

  const toggleDoc = (doc: SavedDocument) => {
    const currentlySelected = savedDocuments.filter(d => selectedDocIds.includes(d.id));
    if (selectedDocIds.includes(doc.id)) {
      // Deselect: remove this doc from the selection
      onSelectDocuments(currentlySelected.filter(d => d.id !== doc.id));
    } else {
      // Select: add this doc to the selection
      onSelectDocuments([...currentlySelected, doc]);
    }
  };

  const selectAll = () => {
    if (selectedDocIds.length === savedDocuments.length) {
      onSelectDocuments([]);
    } else {
      onSelectDocuments(savedDocuments);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <View style={{ gap: Spacing.md }}>
      {savedDocuments.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>
              {selectedDocIds.length} of {savedDocuments.length} selected
            </Text>
            <TouchableOpacity onPress={selectAll}>
              <Text style={{ fontSize: FontSize.sm, color: C.primary }}>
                {selectedDocIds.length === savedDocuments.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {savedDocuments.map(doc => (
              <TouchableOpacity key={doc.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                  padding: Spacing.md, borderRadius: BorderRadius.md,
                  marginBottom: Spacing.xs, borderWidth: 1,
                  borderColor: selectedDocIds.includes(doc.id) ? C.primary + '80' : C.border,
                  backgroundColor: selectedDocIds.includes(doc.id) ? C.primary + '10' : C.muted + '50',
                }}
                onPress={() => toggleDoc(doc)}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                  borderColor: selectedDocIds.includes(doc.id) ? C.primary : C.border,
                  backgroundColor: selectedDocIds.includes(doc.id) ? C.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedDocIds.includes(doc.id) &&
                    <Ionicons name="checkmark" size={12} color={C.primaryForeground} />
                  }
                </View>
                <Ionicons name="document-outline" size={16} color={C.foreground} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.foreground, fontWeight: '500' }} numberOfLines={1}>{doc.name}</Text>
                  <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>
                    {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
                  </Text>
                </View>
                <TouchableOpacity onPress={(e) => { if(e && e.stopPropagation) e.stopPropagation(); setPreviewDoc(doc); }} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="eye-outline" size={16} color={C.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { if(e && e.stopPropagation) e.stopPropagation();
                  Alert.alert('Delete Document?', `Delete "${doc.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => onRemoveDocument(doc.id) },
                  ]);
                }}>
                  <Ionicons name="trash-outline" size={16} color={C.mutedForeground} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {!showUpload ? (
        <TouchableOpacity style={{
          borderWidth: 1, borderStyle: 'dashed', borderColor: C.border,
          borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center',
        }} onPress={() => setShowUpload(true)}>
          <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>+ Upload New Documents</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: Spacing.md }}>
          <FileUpload uploadedFiles={uploadFiles} onFilesProcessed={setUploadFiles} onRemoveFile={(name) => setUploadFiles(prev => prev.filter(f => f.name !== name))} />
          {uploadFiles.length > 0 && (
            <TouchableOpacity style={{
              backgroundColor: C.primary, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center',
            }} onPress={(e) => { if(e && e.stopPropagation) e.stopPropagation(); uploadFiles.forEach(f => onSaveDocument(f)); setUploadFiles([]); setShowUpload(false); }}>
              <Text style={{ color: C.primaryForeground, fontWeight: '600' }}>Save {uploadFiles.length} File{uploadFiles.length !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {savedDocuments.length === 0 && !showUpload && (
        <View style={{ alignItems: 'center', padding: Spacing.xl, gap: Spacing.xs }}>
          <Ionicons name="document-outline" size={32} color={C.mutedForeground} style={{ opacity: 0.5 }} />
          <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>No documents saved yet</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>Upload DOCX files to save them for future tests</Text>
        </View>
      )}

      <Modal visible={!!previewDoc} transparent animationType="fade" onRequestClose={() => setPreviewDoc(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
          <View style={{
            backgroundColor: C.card, borderRadius: BorderRadius.lg, width: '100%', maxWidth: 600, maxHeight: '85%',
            borderWidth: 1, borderColor: C.border, overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
                <Ionicons name="document-text-outline" size={20} color={C.foreground} />
                <Text style={{ fontSize: FontSize.md, color: C.foreground, fontWeight: '600' }} numberOfLines={1}>{previewDoc?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewDoc(null)} style={{ padding: Spacing.xs, marginLeft: Spacing.sm }}>
                <Ionicons name="close" size={22} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, maxHeight: 500 }} contentContainerStyle={{ padding: Spacing.lg }}>
              <Text style={{
                fontSize: FontSize.md, color: C.foreground, fontFamily: 'monospace',
                lineHeight: 22,
              }}>
                {previewDoc?.content.slice(0, 5000) || ""}
              </Text>
              {previewDoc && previewDoc.content.length > 5000 && (
                <View style={{ marginTop: Spacing.md, padding: Spacing.sm, backgroundColor: C.warning + '20', borderRadius: BorderRadius.md }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.warning, textAlign: 'center' }}>
                    Document truncated (showing first 5000 of {previewDoc.content.length} characters)
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

