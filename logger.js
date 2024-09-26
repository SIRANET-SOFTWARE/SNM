const fs = require('fs');
const path = require('path');

class Logger {
  constructor(moduleName) {

    // Set the log directory to the root of the project
    this.logDir = path.join(process.cwd(), 'logs'); 
    this.logFilePath = path.join(this.logDir, 'logs.txt');

    this.moduleName = moduleName;

    // Ensure that the logs directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  rotateLogFile() {
    const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

    if (fs.existsSync(this.logFilePath)) {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > MAX_LOG_SIZE) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const rotatedLogFile = path.join(this.logDir, `logs_${timestamp}.txt`);
        fs.renameSync(this.logFilePath, rotatedLogFile);
      }
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${this.moduleName}] ${this.formatMessage(message)}`;

    // Print to terminal
    console.log(formattedMessage);

    // Rotate log file if needed
    // this.rotateLogFile();

    // Append the log message to the log file
    fs.appendFileSync(this.logFilePath, `${formattedMessage}\n`, 'utf8');
  }

  formatMessage(message) {
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 2); // Pretty print objects with 2-space indentation
    }
    return message;
  }
}

module.exports = Logger;