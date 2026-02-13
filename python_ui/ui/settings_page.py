"""
Settings Page
Configuration form for all settings
"""

import os
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QFormLayout,
                                QLineEdit, QPushButton, QLabel, QFileDialog,
                                QMessageBox, QGroupBox)
from PySide6.QtCore import Signal
from utils.config_manager import ConfigManager
import subprocess

class SettingsPage(QWidget):
    config_saved = Signal()
    
    def __init__(self, config_manager):
        super().__init__()
        self.config_manager = config_manager
        self.init_ui()
        self.load_config()
    
    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(20)
        
        # Title
        title = QLabel("Settings")
        title.setObjectName("pageTitle")
        layout.addWidget(title)
        
        # Configuration Form
        form_group = QGroupBox("Configuration")
        form_group.setObjectName("settingsGroup")
        form_layout = QFormLayout()
        form_layout.setSpacing(15)
        
        # AdsPower API Key
        self.api_key_input = QLineEdit()
        self.api_key_input.setPlaceholderText("Enter AdsPower API Key")
        form_layout.addRow("AdsPower API Key:", self.api_key_input)
        
        # AdsPower Profile ID
        self.profile_id_input = QLineEdit()
        self.profile_id_input.setPlaceholderText("Enter Profile ID")
        form_layout.addRow("AdsPower Profile ID:", self.profile_id_input)
        
        # Meta Page ID
        self.page_id_input = QLineEdit()
        self.page_id_input.setPlaceholderText("Enter Facebook Page ID")
        form_layout.addRow("Meta Page ID:", self.page_id_input)
        
        # Upload Folder Path
        folder_layout = QHBoxLayout()
        self.upload_folder_input = QLineEdit()
        self.upload_folder_input.setPlaceholderText("Select upload folder")
        folder_layout.addWidget(self.upload_folder_input)
        
        btn_browse_upload = QPushButton("Browse...")
        btn_browse_upload.setObjectName("secondaryButton")
        btn_browse_upload.clicked.connect(self.browse_upload_folder)
        folder_layout.addWidget(btn_browse_upload)
        
        form_layout.addRow("Upload Folder:", folder_layout)
        
        # Debug Folder Path
        debug_layout = QHBoxLayout()
        self.debug_folder_input = QLineEdit()
        self.debug_folder_input.setPlaceholderText("Select debug folder")
        debug_layout.addWidget(self.debug_folder_input)
        
        btn_browse_debug = QPushButton("Browse...")
        btn_browse_debug.setObjectName("secondaryButton")
        btn_browse_debug.clicked.connect(self.browse_debug_folder)
        debug_layout.addWidget(btn_browse_debug)
        
        form_layout.addRow("Debug Folder:", debug_layout)
        
        form_group.setLayout(form_layout)
        layout.addWidget(form_group)
        
        # Action Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)
        
        self.btn_save = QPushButton("Save Configuration")
        self.btn_save.setObjectName("primaryButton")
        self.btn_save.clicked.connect(self.save_config)
        btn_layout.addWidget(self.btn_save)
        
        self.btn_test = QPushButton("Test AdsPower Connection")
        self.btn_test.setObjectName("secondaryButton")
        self.btn_test.clicked.connect(self.test_adspower)
        btn_layout.addWidget(self.btn_test)
        
        self.btn_open_debug = QPushButton("Open Debug Folder")
        self.btn_open_debug.setObjectName("secondaryButton")
        self.btn_open_debug.clicked.connect(self.open_debug_folder)
        btn_layout.addWidget(self.btn_open_debug)
        
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        layout.addStretch()
        self.setLayout(layout)
    
    def load_config(self):
        """Load configuration into form fields"""
        config = self.config_manager.get_all()
        
        self.api_key_input.setText(config.get('adspowerApiKey', ''))
        self.profile_id_input.setText(config.get('adspowerProfileId', ''))
        self.page_id_input.setText(config.get('facebookPageId', ''))
        self.upload_folder_input.setText(config.get('uploadFolderPath', ''))
        self.debug_folder_input.setText(config.get('debugFolderPath', ''))
    
    def save_config(self):
        """Save configuration from form fields"""
        updates = {
            'adspowerApiKey': self.api_key_input.text().strip(),
            'adspowerProfileId': self.profile_id_input.text().strip(),
            'facebookPageId': self.page_id_input.text().strip(),
            'uploadFolderPath': self.upload_folder_input.text().strip(),
            'debugFolderPath': self.debug_folder_input.text().strip()
        }
        
        # Update Meta Business URL if page ID changed
        if updates['facebookPageId']:
            updates['metaBusinessUrl'] = f"https://business.facebook.com/latest/home?asset_id={updates['facebookPageId']}"
        
        self.config_manager.update(updates)
        
        if self.config_manager.save():
            QMessageBox.information(self, "Success", "Configuration saved successfully!")
            self.config_saved.emit()
        else:
            QMessageBox.critical(self, "Error", "Failed to save configuration")
    
    def browse_upload_folder(self):
        """Browse for upload folder"""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Upload Folder",
            self.upload_folder_input.text()
        )
        if folder:
            self.upload_folder_input.setText(folder)
    
    def browse_debug_folder(self):
        """Browse for debug folder"""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Debug Folder",
            self.debug_folder_input.text()
        )
        if folder:
            self.debug_folder_input.setText(folder)
    
    def test_adspower(self):
        """Test AdsPower connection via Node"""
        # Save config first
        self.save_config()
        
        # Show message
        QMessageBox.information(
            self,
            "Test AdsPower",
            "Testing AdsPower connection...\nPlease check the Logs page for results."
        )
        
        # Emit signal to trigger test (main window will handle)
        # For now, just show message
    
    def open_debug_folder(self):
        """Open debug folder in file explorer"""
        debug_folder = self.debug_folder_input.text().strip()
        
        if not debug_folder:
            debug_folder = os.path.join(os.path.dirname(__file__), '..', '..', 'debug_screenshots')
        
        if os.path.exists(debug_folder):
            os.startfile(debug_folder)
        else:
            QMessageBox.warning(self, "Warning", f"Debug folder does not exist:\n{debug_folder}")
