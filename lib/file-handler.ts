import mammoth from 'mammoth';
import { File } from 'expo-file-system';
import { UploadedFile } from './types';

export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX file');
  }
}

export async function extractTextFromFile(uri: string, name: string): Promise<{ name: string; content: string; size: number }> {
  if (name.endsWith('.txt')) {
    const file = new File(uri);
    const content = await file.text();
    const info = file.info();
    const fileSize = info.size || 0;
    return { name, content, size: fileSize };
  }

  if (name.endsWith('.docx')) {
    const file = new File(uri);
    const base64 = await file.base64();
    const binaryStr = globalThis.atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const content = await extractTextFromDocx(bytes.buffer);
    const info = file.info();
    const fileSize = info.size || 0;
    return { name, content, size: fileSize };
  }

  throw new Error('Unsupported file type. Only .docx and .txt files are supported.');
}

export function combineContent(notes: string, files: UploadedFile[]): string {
  const parts: string[] = [];
  if (notes.trim()) parts.push(notes.trim());
  for (const file of files) {
    if (file.content.trim()) {
      parts.push(`--- Content from ${file.name} ---\n${file.content.trim()}`);
    }
  }
  return parts.join('\n\n');
}

export { formatFileSize } from './utils';
