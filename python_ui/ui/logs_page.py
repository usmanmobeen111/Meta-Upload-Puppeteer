"""
Logs Page
Displays live logs from Node backend with color-coded levels
"""

from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
                                QTextEdit, QFileDialog)
from PySide6.QtCore import Qt, QDateTime
from PySide6.QtGui import QTextCursor, QColor
from datetime import datetime

class LogsPage(QWidget):
    def __init__(self):
        super().__init__()
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing (15)
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)
        
        self.btn_clear = QPushButton("Clear Logs")
        self.btn_clear.setObjectName("primaryButton")
        self.btn_clear.clicked.connect(self.clear_logs)
        btn_layout.addWidget(self.btn_clear)
        
        self.btn_save = QPushButton("Save Logs to File")
        self.btn_save.setObjectName("secondaryButton")
        self.btn_save.clicked.connect(self.save_logs)
        btn_layout.addWidget(self.btn_save)
        
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        # Log text area
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setObjectName("logTextEdit")
        layout.addWidget(self.log_text)
        
        self.setLayout(layout)
    
    def add_log(self, log_data):
        """Add a log entry"""
        level = log_data.get('level', 'info')
        message = log_data.get('message', '')
        timestamp = log_data.get('timestamp', '')
        
        # Format timestamp
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                time_str = dt.strftime('%H:%M:%S')
            except:
                time_str = datetime.now().strftime('%H:%M:%S')
        else:
            time_str = datetime.now().strftime('%H:%M:%S')
        
        # Color based on level
        color_map = {
            'info': '#B0BEC5',
            'success': '#66BB6A',
            'error': '#EF5350',
            'warn': '#FFA726',
            'step': '#42A5F5'
        }
        color = color_map.get(level, '#B0BEC5')
        
        # Level badge
        level_badge = level.upper()
        
        # Format log entry
        html = f'<span style="color: #607D8B;">[{time_str}]</span> '
        html += f'<span style="color: {color}; font-weight: bold;">[{level_badge}]</span> '
        html += f'<span style="color: #ECEFF1;">{message}</span><br>'
        
        # Append to log
        self.log_text.moveCursor(QTextCursor.MoveOperation.End)
        self.log_text.insertHtml(html)
        self.log_text.moveCursor(QTextCursor.MoveOperation.End)
    
    def clear_logs(self):
        """Clear all logs"""
        self.log_text.clear()
    
    def save_logs(self):
        """Save logs to file"""
        filename, _ = QFileDialog.getSaveFileName(
            self,
            "Save Logs",
            "logs.txt",
            "Text Files (*.txt);;All Files (*)"
        )
        
        if filename:
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(self.log_text.toPlainText())
                self.add_log({
                    'level': 'success',
                    'message': f'Logs saved to {filename}'
                })
            except Exception as e:
                self.add_log({
                    'level': 'error',
                    'message': f'Failed to save logs: {str(e)}'
                })
