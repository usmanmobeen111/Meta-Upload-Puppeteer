"""
Main Window
Contains sidebar navigation and stacked pages
"""

import os
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                                QPushButton, QStackedWidget, QLabel, QMessageBox)
from PySide6.QtCore import Qt, Slot
from PySide6.QtGui import QIcon

from utils.config_manager import ConfigManager
from utils.node_runner import NodeRunner
from ui.progress_panel import ProgressPanel
from ui.settings_page import SettingsPage
from ui.video_queue_page import VideoQueuePage
from ui.logs_page import LogsPage

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # Initialize config manager
        self.config_manager = ConfigManager()
        
        # Initialize node runner
        self.node_runner = NodeRunner()
        self.setup_node_signals()
        
        self.init_ui()
    
    def init_ui(self):
        self.setWindowTitle("Meta Upload Dashboard")
        self.setMinimumSize(1200, 700)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Progress panel at top
        self.progress_panel = ProgressPanel()
        main_layout.addWidget(self.progress_panel)
        
        # Content area (sidebar + pages)
        content_layout = QHBoxLayout()
        content_layout.setContentsMargins(0, 0, 0, 0)
        content_layout.setSpacing(0)
        
        # Sidebar
        sidebar = self.create_sidebar()
        content_layout.addWidget(sidebar)
        
        # Stacked widget for pages
        self.stack = QStackedWidget()
        
        # Create pages
        self.video_queue_page = VideoQueuePage(self.config_manager)
        self.settings_page = SettingsPage(self.config_manager)
        self.logs_page = LogsPage()
        self.about_page = self.create_about_page()
        
        # Add pages to stack
        self.stack.addWidget(self.video_queue_page)  # 0
        self.stack.addWidget(self.settings_page)     # 1
        self.stack.addWidget(self.logs_page)         # 2
        self.stack.addWidget(self.about_page)        # 3
        
        content_layout.addWidget(self.stack, 1)
        
        main_layout.addLayout(content_layout)
        central_widget.setLayout(main_layout)
        
        # Connect signals
        self.setup_page_signals()
        
        # Show dashboard by default
        self.show_page(0)
    
    def create_sidebar(self):
        """Create sidebar with navigation buttons"""
        sidebar = QWidget()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(220)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 20, 0, 20)
        layout.setSpacing(10)
        
        # Logo/Title
        title = QLabel("Meta Upload\nDashboard")
        title.setObjectName("sidebarTitle")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        layout.addSpacing(20)
        
        # Navigation buttons
        self.nav_buttons = []
        
        btn_dashboard = self.create_nav_button("📊 Dashboard", 0)
        layout.addWidget(btn_dashboard)
        self.nav_buttons.append(btn_dashboard)
        
        btn_settings = self.create_nav_button("⚙️ Settings", 1)
        layout.addWidget(btn_settings)
        self.nav_buttons.append(btn_settings)
        
        btn_logs = self.create_nav_button("📄 Logs", 2)
        layout.addWidget(btn_logs)
        self.nav_buttons.append(btn_logs)
        
        btn_about = self.create_nav_button("ℹ️ About", 3)
        layout.addWidget(btn_about)
        self.nav_buttons.append(btn_about)
        
        layout.addStretch()
        
        sidebar.setLayout(layout)
        return sidebar
    
    def create_nav_button(self, text, page_index):
        """Create a navigation button"""
        btn = QPushButton(text)
        btn.setObjectName("navButton")
        btn.setCheckable(True)
        btn.clicked.connect(lambda: self.show_page(page_index))
        return btn
    
    def create_about_page(self):
        """Create about page"""
        page = QWidget()
        layout = QVBoxLayout()
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)
        
        title = QLabel("About Meta Upload Dashboard")
        title.setObjectName("pageTitle")
        layout.addWidget(title)
        
        info = QLabel(
            "<h3>Meta Upload Dashboard v1.0</h3>"
            "<p>A premium PySide6 dashboard for controlling Meta Business Suite video uploads.</p>"
            "<p><b>Features:</b></p>"
            "<ul>"
            "<li>Auto-detect video duration (POST vs REEL)</li>"
            "<li>Batch upload unposted videos</li>"
            "<li>Real-time progress tracking</li>"
            "<li>Live log streaming</li>"
            "<li>AdsPower integration</li>"
            "</ul>"
            "<p><b>Technology Stack:</b></p>"
            "<ul>"
            "<li>PySide6 (Python Qt framework)</li>"
            "<li>Node.js + Puppeteer (Automation backend)</li>"
            "<li>FFprobe (Video duration detection)</li>"
            "</ul>"
            "<p style='margin-top: 40px; color: #607D8B;'>© 2026 Meta Automation. All rights reserved.</p>"
        )
        info.setWordWrap(True)
        info.setTextFormat(Qt.TextFormat.RichText)
        layout.addWidget(info)
        
        layout.addStretch()
        page.setLayout(layout)
        return page
    
    def show_page(self, index):
        """Show a page and update navigation"""
        self.stack.setCurrentIndex(index)
        
        # Update button states
        for i, btn in enumerate(self.nav_buttons):
            btn.setChecked(i == index)
    
    def setup_page_signals(self):
        """Connect signals from pages"""
        # Video queue page signals
        self.video_queue_page.post_single_requested.connect(self.handle_post_single)
        self.video_queue_page.post_all_requested.connect(self.handle_post_all)
        self.video_queue_page.stop_requested.connect(self.handle_stop)
        self.video_queue_page.mark_posted_requested.connect(self.handle_mark_posted)
        
        # Settings page signals
        self.settings_page.config_saved.connect(self.handle_config_saved)
    
    def setup_node_signals(self):
        """Connect signals from node runner"""
        self.node_runner.log_received.connect(self.handle_log)
        self.node_runner.progress_updated.connect(self.handle_progress)
        self.node_runner.video_status_changed.connect(self.handle_video_status)
        self.node_runner.command_completed.connect(self.handle_command_completed)
    
    @Slot(str)
    def handle_post_single(self, folder_path):
        """Handle posting single video"""
        # Show progress panel
        folder_name = os.path.basename(folder_path)
        self.progress_panel.set_video(folder_name)
        self.progress_panel.set_progress(0, "Starting...")
        
        # Run node command
        self.node_runner.run_command('post-single', folder_path)
        
        # Switch to logs page
        self.show_page(2)
    
    @Slot(str)
    def handle_post_all(self, upload_folder):
        """Handle posting all videos"""
        self.progress_panel.set_video("Batch Upload")
        self.progress_panel.set_progress(0, "Starting batch upload...")
        
        # Run node command
        self.node_runner.run_command('post-all', upload_folder)
        
        # Switch to logs page
        self.show_page(2)
    
    @Slot()
    def handle_stop(self):
        """Handle stop request"""
        if self.node_runner.stop():
            self.progress_panel.reset()
            self.logs_page.add_log({
                'level': 'warn',
                'message': 'Posting stopped by user'
            })
    
    @Slot(str)
    def handle_mark_posted(self, folder_path):
        """Handle marking video as posted"""
        # Import status marker
        import sys
        import json
        
        folder_name = os.path.basename(folder_path)
        posted_dir = os.path.join(folder_path, 'Posted')
        os.makedirs(posted_dir, exist_ok=True)
        
        status_path = os.path.join(posted_dir, 'status.json')
        status_data = {
            'posted': True,
            'timestamp': __import__('datetime').datetime.now().isoformat(),
            'method': 'manual'
        }
        
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump(status_data, f, indent=2)
        
        # Update UI
        self.video_queue_page.update_video_status(folder_name, 'POSTED')
        self.logs_page.add_log({
            'level': 'success',
            'message': f'Marked as posted: {folder_name}'
        })
    
    @Slot()
    def handle_config_saved(self):
        """Handle config saved"""
        self.logs_page.add_log({
            'level': 'success',
            'message': 'Configuration saved successfully'
        })
    
    @Slot(dict)
    def handle_log(self, log_data):
        """Handle log from node runner"""
        self.logs_page.add_log(log_data)
    
    @Slot(int, str)
    def handle_progress(self, value, step):
        """Handle progress update"""
        self.progress_panel.set_progress(value, step)
    
    @Slot(str, str)
    def handle_video_status(self, video_name, status):
        """Handle video status change"""
        self.video_queue_page.update_video_status(video_name, status)
        
        if status == 'posted':
            self.logs_page.add_log({
                'level': 'success',
                'message': f'✅ Posted: {video_name}'
            })
    
    @Slot(bool, str)
    def handle_command_completed(self, success, message):
        """Handle command completion"""
        if success:
            self.progress_panel.reset()
            self.logs_page.add_log({
                'level': 'success',
                'message': message
            })
            # Refresh video queue
            self.video_queue_page.scan_videos()
        else:
            self.progress_panel.reset()
            self.logs_page.add_log({
                'level': 'error',
                'message': message
            })
