import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.logFile = this.createLogFile();
  }

  createLogFile() {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const logFile = path.join(logsDir, `test-${timestamp}.log`);
    
    return logFile;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    // ファイルに記録
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error(chalk.red('ログファイル書き込みエラー:'), error.message);
    }
    
    // コンソール出力
    if (level === 'ERROR') {
      console.error(chalk.red(message));
    } else if (level === 'WARN') {
      console.warn(chalk.yellow(message));
    } else if (level === 'DEBUG') {
      if (this.verbose) {
        console.log(chalk.gray(message));
      }
    } else {
      console.log(message);
    }
  }

  info(message) {
    this.log(message, 'INFO');
  }

  error(message) {
    this.log(message, 'ERROR');
  }

  warn(message) {
    this.log(message, 'WARN');
  }

  debug(message) {
    this.log(message, 'DEBUG');
  }

  success(message) {
    const logMessage = `✅ ${message}`;
    this.log(logMessage, 'SUCCESS');
    console.log(chalk.green(logMessage));
  }

  fail(message) {
    const logMessage = `❌ ${message}`;
    this.log(logMessage, 'FAIL');
    console.log(chalk.red(logMessage));
  }

  getLogFilePath() {
    return this.logFile;
  }
}

export default Logger;