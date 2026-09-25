function registrarPago(req, res) {
  return res.status(200).json({
    ok: false,
    motivo: 'wallet no implementada aún'
  });
}

module.exports = { registrarPago };