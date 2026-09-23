export const createCartItem = ({
  id,
  name,
  price,
  quantity = 1,
}) => ({
  id,
  name,
  price,
  quantity,
});