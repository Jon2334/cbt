import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CBT Android</Text>
      <Text style={styles.subtitle}>Aplikasi Ujian Berbasis Komputer untuk Siswa</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fitur Utama</Text>
        <Text style={styles.cardText}>• Login siswa</Text>
        <Text style={styles.cardText}>• Lihat daftar ujian tersedia</Text>
        <Text style={styles.cardText}>• Mengerjakan soal dengan timer</Text>
        <Text style={styles.cardText}>• Simpan & kirim jawaban</Text>
        <Text style={styles.cardText}>• Lihat hasil & riwayat ujian</Text>
      </View>

      <Button
        title="Mulai Ujian (Demo)"
        onPress={() => Alert.alert('Info', 'Fitur ujian akan diimplementasikan di tahap selanjutnya')}
        color="#2a7ae2"
      />

      <Text style={styles.footer}>Versi 1.0.0 — Fondasi Proyek</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e3a5f',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#5a6c7d',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e3a5f',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    color: '#3d4a5a',
    marginBottom: 6,
  },
  footer: {
    fontSize: 12,
    color: '#9aa5b1',
    textAlign: 'center',
    marginTop: 32,
  },
});