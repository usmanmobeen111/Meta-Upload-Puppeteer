"""
Meta Upload Dashboard - Python UI
Main entry point for PySide6 application
"""

import sys
import os
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from ui.main_window import MainWindow

def main():
    # Enable High DPI scaling
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    
    app = QApplication(sys.argv)
    app.setApplicationName("Meta Upload Dashboard")
    app.setOrganizationName("Meta Automation")
    
    # Set default font with emoji support
    # Try Segoe UI first, but don't force it (allows emoji fallback)
    font = QFont()
    font.setFamily("Segoe UI")
    font.setPointSize(10)
    app.setFont(font)
    
    # Load stylesheet
    stylesheet_path = os.path.join(os.path.dirname(__file__), 'styles', 'dark.qss')
    if os.path.exists(stylesheet_path):
        with open(stylesheet_path, 'r', encoding='utf-8') as f:
            app.setStyleSheet(f.read())
    
    # Create and show main window
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
