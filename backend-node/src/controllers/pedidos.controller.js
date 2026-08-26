const { pedidosMock } = require('../utils/pedidosMock');

function getPedidos(req, res) {
  return res.status(200).json(pedidosMock);
}

module.exports = { getPedidos };