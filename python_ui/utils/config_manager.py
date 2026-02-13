"""
Configuration Manager
Handles loading and saving config.json
"""

import json
import os
from pathlib import Path

class ConfigManager:
    def __init__(self, config_path=None):
        if config_path is None:
            # Default to parent directory config.json
            base_dir = Path(__file__).parent.parent.parent
            self.config_path = base_dir / 'config.json'
        else:
            self.config_path = Path(config_path)
        
        self.config = {}
        self.load()
    
    def load(self):
        """Load configuration from file"""
        if not self.config_path.exists():
            # Create default config
            self.config = {
                'adspowerApiKey': '',
                'adspowerProfileId': '',
                'facebookPageId': '',
                'metaBusinessUrl': 'https://business.facebook.com/latest/home',
                'uploadFolderPath': '',
                'debugFolderPath': '',
                'headless': False,
                'debugMode': True,
                'maxRetries': 3,
                'uploadTimeoutSeconds': 300
            }
            self.save()
        else:
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
            except Exception as e:
                print(f"Error loading config: {e}")
                self.config = {}
    
    def save(self):
        """Save configuration to file"""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def get(self, key, default=None):
        """Get a configuration value"""
        return self.config.get(key, default)
    
    def set(self, key, value):
        """Set a configuration value"""
        self.config[key] = value
    
    def get_all(self):
        """Get all configuration"""
        return self.config.copy()
    
    def update(self, updates):
        """Update multiple configuration values"""
        self.config.update(updates)
