import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import Icon from './Icon';

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
              accessibilityRole="button"
              accessibilityLabel={`Quitar una unidad de ${item.name}`}
            >
              {/* S2-T3: icono vectorial en vez del glifo '−'. */}
              <Icon
                name="remove"
                size={18}
                color={isMinimumQuantity ? colors.textoDeshabilitadoClaro : colors.textoMedioClaro}
              />
            </TouchableOpacity>

            <Text style={styles.quantity}>
              {item.quantity}
            </Text>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onIncrease(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Agregar una unidad de ${item.name}`}
            >
              {/* S2-T3: icono vectorial en vez del glifo '+'. */}
              <Icon name="add" size={18} color={colors.textoMedioClaro} />
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
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 12,
    shadowColor: colors.sombra,
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
    borderRadius: radius.md,
    backgroundColor: colors.superficieCrema,
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
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.textoOscuro,
  },

  description: {
    fontSize: 11,
    color: colors.textoSecundario,
    marginTop: 3,
  },

  priceInfo: {
    marginTop: 7,
  },

  unitPrice: {
    fontSize: typography.etiqueta,
    color: colors.textoTenue,
  },

  subtotal: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoPrimario,
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
    backgroundColor: colors.fondoSuave,
    borderRadius: radius.xl,
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

  quantity: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: typography.cuerpoPequeno,
    color: colors.textoPrimario,
  },

  removeButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  removeButtonText: {
    fontSize: typography.etiqueta,
    fontWeight: typography.pesoMedio,
    color: colors.textoMarron,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayModal,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  modalContainer: {
    width: '100%',
    backgroundColor: colors.superficieHueso,
    borderRadius: radius.xxl,
    padding: 24,
    alignItems: 'center',
    elevation: 8,

    shadowColor: colors.sombra,
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
    backgroundColor: colors.superficieCrema,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  modalEmoji: {
    fontSize: 32,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: typography.pesoBold,
    color: colors.textoPrimario,
    textAlign: 'center',
  },

  modalProductName: {
    fontSize: typography.cuerpo,
    fontWeight: typography.pesoBold,
    color: colors.marronMedio,
    textAlign: 'center',
    marginTop: 6,
  },

  modalDescription: {
    fontSize: typography.cuerpoPequeno,
    color: colors.textoSecundario,
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
    borderRadius: radius.md,
    backgroundColor: colors.superficieCrema,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },

  cancelButtonText: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.marronMedio,
  },

  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.textoPrimario,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },

  confirmButtonText: {
    fontSize: typography.cuerpoPequeno,
    fontWeight: typography.pesoBold,
    color: colors.textoBlanco,
  },
});

export default CartItem;