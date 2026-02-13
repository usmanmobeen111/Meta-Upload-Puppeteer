"""
Progress Panel Component
Shows current upload progress, progress bar, and current step
"""

from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QProgressBar
from PySide6.QtCore import Qt

class ProgressPanel(QWidget):
    def __init__(self):
        super().__init__()
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 15, 20, 15)
        layout.setSpacing(10)
        
        # Current video label
        self.video_label = QLabel("No video being processed")
        self.video_label.setObjectName("currentVideoLabel")
        layout.addWidget(self.video_label)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFormat("%p%")
        layout.addWidget(self.progress_bar)
        
        # Current step label
        self.step_label = QLabel("")
        self.step_label.setObjectName("stepLabel")
        self.step_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.step_label)
        
        self.setLayout(layout)
        self.setObjectName("progressPanel")
    
    def set_video(self, video_name):
        """Set the current video being processed"""
        self.video_label.setText(f"Processing: {video_name}")
    
    def set_progress(self, value, step_text=""):
        """Update progress bar and step text"""
        self.progress_bar.setValue(value)
        if step_text:
            self.step_label.setText(step_text)
    
    def reset(self):
        """Reset the progress panel"""
        self.video_label.setText("No video being processed")
        self.progress_bar.setValue(0)
        self.step_label.setText("")
