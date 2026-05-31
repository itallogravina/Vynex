import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { MenuItem, Priority } from '@vynex/shared'

type Props = {
  item: MenuItem | null
  onClose: () => void
  onAddItem: (payload: { productId: string; qty: number; note: string; priority: Priority }) => void
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: Priority.NORMAL, label: 'Normal' },
  { value: Priority.URGENT, label: 'Urgente' },
  { value: Priority.VIP, label: 'VIP' },
]

export default function QuickOrderPopover({ item, onClose, onAddItem }: Props) {
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL)

  useEffect(() => {
    if (item) {
      setQty(1)
      setNote('')
      setPriority(Priority.NORMAL)
    }
  }, [item?.id])

  if (!item) return null

  const subtotal = (item.price * qty).toFixed(2)

  const handleConfirm = () => {
    onAddItem({ productId: item.id, qty, note, priority })
    onClose()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.popover}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.unitPrice}>R$ {item.price.toFixed(2)} / un.</Text>

                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepBtn, qty <= 1 && styles.stepBtnDisabled]}
                    onPress={() => setQty(q => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, qty >= 20 && styles.stepBtnDisabled]}
                    onPress={() => setQty(q => Math.min(20, q + 1))}
                    disabled={qty >= 20}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.priorityRow}>
                  {PRIORITIES.map(p => (
                    <TouchableOpacity
                      key={p.value}
                      style={[
                        styles.priorityBtn,
                        priority === p.value && priorityActiveStyle[p.value],
                      ]}
                      onPress={() => setPriority(p.value)}
                    >
                      <Text
                        style={[
                          styles.priorityBtnText,
                          priority === p.value && styles.priorityBtnTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.notesInput}
                  placeholder="Observações (opcional)..."
                  placeholderTextColor="#aaa"
                  value={note}
                  onChangeText={text => setNote(text.slice(0, 120))}
                  maxLength={120}
                  multiline
                />
                <Text style={styles.charCount}>{note.length}/120</Text>

                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Text style={styles.confirmBtnText}>
                    Adicionar {qty}× · R$ {subtotal}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const priorityActiveStyle: Record<Priority, object> = {
  [Priority.NORMAL]: { backgroundColor: '#e8f5e9', borderColor: '#27ae60' },
  [Priority.URGENT]: { backgroundColor: '#fff3e0', borderColor: '#f39c12' },
  [Priority.VIP]: { backgroundColor: '#fffde7', borderColor: '#f1c40f' },
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popover: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  unitPrice: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  stepBtnText: {
    fontSize: 22,
    color: 'white',
    fontWeight: '600',
    lineHeight: 26,
  },
  qtyText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    minWidth: 40,
    textAlign: 'center',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  priorityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  priorityBtnTextActive: {
    color: '#333',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'right',
    marginBottom: 20,
  },
  confirmBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
})
