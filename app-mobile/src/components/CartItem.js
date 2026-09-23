import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';

const CartItem = ({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const subtotal = item.price * item.quantity;
  const isMinimumQuantity = item.quantity === 1;

  const handleRemove = () => {
    setShowDeleteModal(false);
    onRemove(item.id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imageEmoji}>
          {item.emoji}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>

        <Text style={styles.description}>
          {item.description}
        </Text>

        <View style={styles.priceInfo}>
          <Text style={styles.unitPrice}>
            ${item.price.toLocaleString('es-CL')} c/u
          </Text>

          <Text style={styles.subtotal}>
            Subtotal: ${subtotal.toLocaleString('es-CL')}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={[
                styles.quantityButton,
                isMinimumQuantity && styles.quantityButtonDisabled,
              ]}
              onPress={() => onDecrease(item.id)}
              disabled={isMinimumQuantity}
            >
              <Text
                style={[
                  styles.quantityButtonText,
                  isMinimumQuantity &&
                    styles.quantityButtonTextDisabled,
                ]}
              >
                −
              </Text>
            </TouchableOpacity>

            <Text style={styles.quantity}>
              {item.quantity}
            </Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onIncrease(item.id)}
            >
              <Text style={styles.quantityButtonText}>
                +
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => setShowDeleteModal(true)}
          >
            <Text style={styles.removeButtonText}>
              Eliminar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalEmoji}>
                {item.emoji}
              </Text>
            </View>

            <Text style={styles.modalTitle}>
              Eliminar producto
            </Text>

            <Text style={styles.modalProductName}>
              {item.name}
            </Text>

            <Text style={styles.modalDescription}>
              ¿Seguro que quieres eliminar este producto
              del carrito?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleRemove}
              >
                <Text style={styles.confirmButtonText}>
                  Eliminar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  imagePlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#F3E7DD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  imageEmoji: {
    fontSize: 32,
  },

  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },

  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2B26',
  },

  description: {
    fontSize: 11,
    color: '#8A7B76',
    marginTop: 3,
  },

  priceInfo: {
    marginTop: 7,
  },

  unitPrice: {
    fontSize: 10,
    color: '#958781',
  },

  subtotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A332C',
    marginTop: 2,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F5F3',
    borderRadius: 20,
    paddingHorizontal: 4,
  },

  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  quantityButtonDisabled: {
    opacity: 0.35,
  },

  quantityButtonText: {
    fontSize: 17,
    color: '#7C6B65',
  },

  quantityButtonTextDisabled: {
    color: '#B8AAA4',
  },

  quantity: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 12,
    color: '#4A332C',
  },

  removeButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  removeButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8A6A60',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 43, 38, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFDFB',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 8,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },

  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3E7DD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  modalEmoji: {
    fontSize: 32,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A332C',
    textAlign: 'center',
  },

  modalProductName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6D554C',
    textAlign: 'center',
    marginTop: 6,
  },

  modalDescription: {
    fontSize: 12,
    color: '#8A7B76',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 10,
  },

  modalButtons: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 22,
  },

  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3E7DD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },

  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D554C',
  },

  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4A332C',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },

  confirmButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default CartItem;