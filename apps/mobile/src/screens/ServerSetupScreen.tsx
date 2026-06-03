import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useTranslation } from '../context/I18nContext'

type Props = {
  initialUrl?: string
  onSave: (url: string) => Promise<void>
}

export default function ServerSetupScreen({ initialUrl, onSave }: Props) {
  const { t } = useTranslation()
  const [url, setUrl] = useState(initialUrl ?? 'http://')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setErrorMsg(null)
    try {
      const clean = url.replace(/\/$/, '')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      let res: Response
      try {
        res = await fetch(`${clean}/health`, { signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      if (res.ok) {
        setTestResult('ok')
      } else {
        setTestResult('error')
        setErrorMsg(`${t('setup.serverRespondedWith')} ${res.status}`)
      }
    } catch (err) {
      setTestResult('error')
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg(t('setup.connectionTimeout'))
      } else {
        setErrorMsg(err instanceof Error ? err.message : t('setup.connectionFailed'))
      }
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(url)
    } finally {
      setSaving(false)
    }
  }

  const busy = testing || saving

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t('setup.title')}</Text>
        <Text style={styles.subtitle}>{t('setup.subtitle')}</Text>

        <Text style={styles.label}>{t('setup.urlLabel')}</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={text => {
            setUrl(text)
            setTestResult(null)
            setErrorMsg(null)
          }}
          placeholder="http://192.168.0.X:3000"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!busy}
        />

        <TouchableOpacity
          style={[styles.testBtn, busy && styles.btnDisabled]}
          onPress={handleTest}
          disabled={busy}
        >
          {testing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.testBtnText}>{t('setup.testBtn')}</Text>
          )}
        </TouchableOpacity>

        {testResult === 'ok' && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✓ {t('setup.serverFound')}</Text>
          </View>
        )}
        {testResult === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>✕ {errorMsg ?? t('setup.connectionFailed')}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (testResult !== 'ok' || busy) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={testResult !== 'ok' || busy}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{t('setup.saveBtn')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  testBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  testBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  successText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.4,
  },
})
