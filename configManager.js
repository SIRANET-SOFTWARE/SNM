const fs = require('fs');
const yaml = require('js-yaml');
const Logger = require('./logger.js');

const logger = new Logger('ConfigManager');


class ConfigManager {

  constructor(configPath) {
    logger.log('Creating ConfigManager instance');
    logger.log(`Config path: ${configPath}`);
    this.configPath = configPath;
    this.configData = this.loadConfig();
  }

  loadConfig() {
    try {
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      logger.log(`Loaded config from ${this.configPath}`);
      return yaml.load(fileContents);
    } catch (error) {
      logger.log('Failed to load config file: ' + error.message);
      throw error;
    }
  }

  saveConfig() {
    try {
      const yamlStr = yaml.dump(this.configData);
      fs.writeFileSync(this.configPath, yamlStr, 'utf8');
      logger.log(`Saved config to ${this.configPath}`);
    } catch (error) {
      logger.log('Failed to save config file: ' + error.message);
      throw error;
    }
  }

  getAuthConfig() {
    logger.log('Retrieved AUTH config');
    const configString = JSON.stringify(this.configData.AUTH);
    return this.configData.AUTH;
  }

  updateTokens(newAccessToken, newRefreshToken, tokenExpirationTime) {
    this.configData.AUTH.ACCESS_TOKEN = newAccessToken;
    this.configData.AUTH.REFRESH_TOKEN = newRefreshToken;
    this.configData.AUTH.token_expiration_time = tokenExpirationTime;
    this.saveConfig();
    logger.log('Updated tokens and expiration time in config');
  }

}

module.exports = ConfigManager;