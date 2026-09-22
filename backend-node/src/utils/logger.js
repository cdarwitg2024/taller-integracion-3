const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid
    };
    
    const logStr = JSON.stringify(logEntry) + '\n';
    const logFile = path.join(this.logDir, `${level}.log`);
    
    // En desarrollo, también mostrar en consola
    if (process.env.NODE_ENV === 'development') {
      console[level === 'error' ? 'error' : 'log'](
        `[${timestamp}] ${level.toUpperCase()}: ${message}`,
        data || ''
      );
    }
    
    // Escribir en archivo (producción)
    if (process.env.NODE_ENV === 'production') {
      fs.appendFileSync(logFile, logStr);
    }
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, data);
    }
  }
}

module.exports = new Logger();