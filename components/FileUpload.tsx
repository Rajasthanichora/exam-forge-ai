import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { UploadedFile } from '../lib/types';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { extractTextFromFile, formatFileSize } from '../lib/file-handler';

interface FileUploadProps {
  uploadedFiles: UploadedFile[];
  onFilesProcessed: (files: UploadedFile[]) => void;
  onRemoveFile: (name: string) => void;
}

export default function FileUpload({ uploadedFiles, onFilesProcessed, onRemoveFile }: FileUploadProps) {
  const { colors: C } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setIsProcessing(true);
      const processedFiles: UploadedFile[] = [];
      for (const file of result.assets) {
        try {
          if (!file.name.endsWith('.docx') && !file.name.endsWith('.txt')) {
            Alert.alert('Skipped', `${file.name}: Only .docx and .txt supported`);
            continue;
          }
          const extracted = await extractTextFromFile(file.uri, file.name);
          processedFiles.push(extracted);
        } catch (err: any) {
          Alert.alert('Error', `Failed to process ${file.name}: ${err.message}`);
        }
      }
      const existingNames = new Set(uploadedFiles.map(f => f.name));
      const newFiles = processedFiles.filter(f => !existingNames.has(f.name));
      if (newFiles.length > 0) onFilesProcessed([...uploadedFiles, ...newFiles]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick files');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalChars = uploadedFiles.reduce((sum, f) => sum + f.content.length, 0);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.dropZone, { borderColor: C.border, backgroundColor: C.muted + '30' }]}
        onPress={() => { handlePick(); }} disabled={isProcessing}>
        {isProcessing ? (
          <Text style={{ fontSize: FontSize.md, color: C.mutedForeground }}>Processing files...</Text>
        ) : (
          <>
            <View style={[styles.uploadIcon, { backgroundColor: C.primary + '10' }]}>
              <Ionicons name="cloud-upload-outline" size={28} color={C.primary} />
            </View>
            <Text style={{ fontSize: FontSize.md, color: C.foreground, fontWeight: '500', textAlign: 'center' }}>
              Drop your study materials here
            </Text>
            <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground, textAlign: 'center' }}>
              Supports .docx and .txt files
            </Text>
            <TouchableOpacity style={[styles.browseBtn, { backgroundColor: C.primary }]}
              onPress={handlePick} disabled={isProcessing}>
              <Text style={{ color: C.primaryForeground, fontSize: FontSize.md, fontWeight: '600' }}>Browse Files</Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>

      {uploadedFiles.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>Uploaded ({uploadedFiles.length})</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>{totalChars.toLocaleString()} chars</Text>
          </View>
          {uploadedFiles.map(file => (
            <View key={file.name} style={[styles.fileItem, { backgroundColor: C.muted + '50', borderColor: C.border }]}>
              <Ionicons name="document-outline" size={18} color={C.foreground} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, color: C.foreground, fontWeight: '500' }} numberOfLines={1}>{file.name}</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>
                  {formatFileSize(file.size)} • {file.content.length.toLocaleString()} chars
                </Text>
              </View>
              <TouchableOpacity onPress={() => { onRemoveFile(file.name); }}>
                <Ionicons name="close-circle" size={18} color={C.destructive} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  dropZone: {
    borderWidth: 2, borderStyle: 'dashed',
    borderRadius: BorderRadius.lg, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.sm,
  },
  uploadIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  browseBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md },
  fileItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1,
  },
});
