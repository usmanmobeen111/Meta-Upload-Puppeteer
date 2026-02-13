"""
Video Queue Page
Displays videos in a table with actions
"""

import os
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
                                QTableWidget, QTableWidgetItem, QLabel, QHeaderView,
                                QAbstractItemView, QMessageBox)
from PySide6.QtCore import Signal, Qt
from PySide6.QtGui import QFont
from utils.video_scanner import VideoScanner

class VideoQueuePage(QWidget):
    post_single_requested = Signal(str)  # folder_path
    post_all_requested = Signal(str)  # upload_folder
    stop_requested = Signal()
    mark_posted_requested = Signal(str)  # folder_path
    
    def __init__(self, config_manager):
        super().__init__()
        self.config_manager = config_manager
        self.scanner = VideoScanner()
        self.video_data = []
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # Title and actions
        header_layout = QHBoxLayout()
        
        title = QLabel("Video Queue")
        title.setObjectName("pageTitle")
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        self.btn_scan = QPushButton("🔄 Scan Folder")
        self.btn_scan.setObjectName("primaryButton")
        self.btn_scan.clicked.connect(self.scan_videos)
        header_layout.addWidget(self.btn_scan)
        
        self.btn_post_all = QPushButton("▶ Post All Unposted")
        self.btn_post_all.setObjectName("successButton")
        self.btn_post_all.clicked.connect(self.post_all)
        header_layout.addWidget(self.btn_post_all)
        
        self.btn_stop = QPushButton("⬛ Stop Current Posting")
        self.btn_stop.setObjectName("dangerButton")
        self.btn_stop.clicked.connect(self.stop_posting)
        header_layout.addWidget(self.btn_stop)
        
        layout.addLayout(header_layout)
        
        # Table
        self.table = QTableWidget()
        self.table.setObjectName("videoTable")
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Folder Name", "Video File", "Duration (s)", "Duration", "Type", "Status", "Actions"
        ])
        
        # Table settings
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        
        # Column widths
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)  # Folder Name
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)  # Video File
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)  # Duration (s)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)  # Duration
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)  # Type
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)  # Status
        header.setSectionResizeMode(6, QHeaderView.ResizeMode.Fixed)  # Actions
        self.table.setColumnWidth(6, 220)
        
        layout.addWidget(self.table)
        
        self.setLayout(layout)
    
    def scan_videos(self):
        """Scan upload folder for videos"""
        upload_folder = self.config_manager.get('uploadFolderPath', '')
        
        if not upload_folder:
            QMessageBox.warning(
                self,
                "No Upload Folder",
                "Please set the upload folder in Settings first."
            )
            return
        
        if not os.path.exists(upload_folder):
            QMessageBox.warning(
                self,
                "Folder Not Found",
                f"Upload folder does not exist:\n{upload_folder}"
            )
            return
        
        # Scan videos
        self.video_data = self.scanner.scan_folder(upload_folder)
        
        # Update table
        self.update_table()
        
        # Show result
        unposted_count = sum(1 for v in self.video_data if v['status'] == 'UNPOSTED')
        QMessageBox.information(
            self,
            "Scan Complete",
            f"Found {len(self.video_data)} video(s)\n{unposted_count} unposted"
        )
    
    def update_table(self):
        """Update table with video data"""
        self.table.setRowCount(0)
        
        for video in self.video_data:
            row = self.table.rowCount()
            self.table.insertRow(row)
            
            # Folder Name
            self.table.setItem(row, 0, QTableWidgetItem(video['folder_name']))
            
            # Video File
            self.table.setItem(row, 1, QTableWidgetItem(video['video_file']))
            
            # Duration (seconds)
            duration_s = video['duration_seconds']
            duration_text = f"{duration_s:.1f}" if duration_s is not None else "N/A"
            self.table.setItem(row, 2, QTableWidgetItem(duration_text))
            
            # Duration (formatted)
            self.table.setItem(row, 3, QTableWidgetItem(video['duration_formatted']))
            
            # Type
            type_item = QTableWidgetItem(video['video_type'])
            if video['video_type'] == 'REEL':
                type_item.setForeground(Qt.GlobalColor.cyan)
            elif video['video_type'] == 'POST':
                type_item.setForeground(Qt.GlobalColor.yellow)
            self.table.setItem(row, 4, type_item)
            
            # Status
            status_item = QTableWidgetItem(video['status'])
            if video['status'] == 'POSTED':
                status_item.setForeground(Qt.GlobalColor.green)
            else:
                status_item.setForeground(Qt.GlobalColor.red)
            self.table.setItem(row, 5, status_item)
            
            # Actions
            actions_widget = self.create_actions_widget(video['folder_path'], video['status'])
            self.table.setCellWidget(row, 6, actions_widget)
    
    def create_actions_widget(self, folder_path, status):
        """Create action buttons for a row"""
        widget = QWidget()
        layout = QHBoxLayout()
        layout.setContentsMargins(5, 2, 5, 2)
        layout.setSpacing(5)
        
        # Inline style to bypass global stylesheet
        button_style = """
            QPushButton {
                background-color: #455A64;
                color: #FFFFFF;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-family: Arial, sans-serif;
                font-size: 11px;
                font-weight: normal;
            }
            QPushButton:hover {
                background-color: #546E7A;
            }
            QPushButton:disabled {
                background-color: #263238;
                color: #607D8B;
            }
        """
        
        # Post Now button
        btn_post = QPushButton("Post Now")
        btn_post.setStyleSheet(button_style)
        btn_post.setEnabled(status == 'UNPOSTED')
        btn_post.clicked.connect(lambda: self.post_single(folder_path))
        layout.addWidget(btn_post)
        
        # Mark Posted button
        btn_mark = QPushButton("Mark Posted")
        btn_mark.setStyleSheet(button_style)
        btn_mark.clicked.connect(lambda: self.mark_posted(folder_path))
        layout.addWidget(btn_mark)
        
        # Open Folder button
        btn_open = QPushButton("Open")
        btn_open.setStyleSheet(button_style)
        btn_open.setMaximumWidth(50)
        btn_open.setToolTip("Open folder in File Explorer")
        btn_open.clicked.connect(lambda: self.open_folder(folder_path))
        layout.addWidget(btn_open)
        
        widget.setLayout(layout)
        return widget
    
    def post_single(self, folder_path):
        """Request to post single video"""
        self.post_single_requested.emit(folder_path)
    
    def post_all(self):
        """Request to post all unposted videos"""
        upload_folder = self.config_manager.get('uploadFolderPath', '')
        
        if not upload_folder:
            QMessageBox.warning(
                self,
                "No Upload Folder",
                "Please set the upload folder in Settings first."
            )
            return
        
        # Count unposted
        unposted_count = sum(1 for v in self.video_data if v['status'] == 'UNPOSTED')
        
        if unposted_count == 0:
            QMessageBox.information(
                self,
                "No Unposted Videos",
                "All videos have already been posted."
            )
            return
        
        # Confirm
        reply = QMessageBox.question(
            self,
            "Confirm Post All",
            f"Post {unposted_count} unposted video(s)?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self.post_all_requested.emit(upload_folder)
    
    def stop_posting(self):
        """Request to stop current posting"""
        self.stop_requested.emit()
    
    def mark_posted(self, folder_path):
        """Mark video as posted"""
        self.mark_posted_requested.emit(folder_path)
    
    def open_folder(self, folder_path):
        """Open folder in file explorer"""
        if os.path.exists(folder_path):
            os.startfile(folder_path)
    
    def update_video_status(self, video_name, status):
        """Update a video's status in the table"""
        for i, video in enumerate(self.video_data):
            if video['folder_name'] == video_name:
                video['status'] = status.upper()
                # Update table cell
                if status.upper() == 'POSTED':
                    self.table.item(i, 5).setText('POSTED')
                    self.table.item(i, 5).setForeground(Qt.GlobalColor.green)
                break
