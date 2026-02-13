"""
Node Runner
Runs Node.js controller as subprocess and parses JSON output
"""

import subprocess
import json
import os
import threading
from pathlib import Path
from PySide6.QtCore import QObject, Signal

class NodeRunner(QObject):
    # Signals for UI updates
    log_received = Signal(dict)  # Emits log data: {level, message, timestamp}
    progress_updated = Signal(int, str)  # Emits progress: (value, step)
    video_status_changed = Signal(str, str)  # Emits: (video_name, status)
    command_completed = Signal(bool, str)  # Emits: (success, message)
    
    def __init__(self):
        super().__init__()
        self.process = None
        self.is_running = False
        
        # Path to Node bridge controller
        base_dir = Path(__file__).parent.parent.parent
        self.controller_path = base_dir / 'node_bridge' / 'controller.js'
        self.node_executable = 'node'
    
    def run_command(self, command, *args):
        """
        Run a Node controller command
        command: 'post-single', 'post-all', 'test-adspower'
        args: command arguments
        """
        if self.is_running:
            self.log_received.emit({
                'level': 'error',
                'message': 'Another command is already running',
                'timestamp': ''
            })
            return False
        
        # Build command line
        cmd = [self.node_executable, str(self.controller_path), command] + list(args)
        
        # Start subprocess in a thread
        thread = threading.Thread(target=self._run_process, args=(cmd,))
        thread.daemon = True
        thread.start()
        
        return True
    
    def _run_process(self, cmd):
        """Run the subprocess and parse JSON output"""
        self.is_running = True
        
        try:
            # Start subprocess
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=1,
                universal_newlines=False,  # Use binary mode
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            # Read stdout line by line
            for line in iter(self.process.stdout.readline, b''):
                if not line:
                    break
                
                # Decode with error handling for ANSI codes
                try:
                    line_str = line.decode('utf-8', errors='replace').strip()
                except:
                    line_str = line.decode('latin-1', errors='replace').strip()
                
                if not line_str:
                    continue
                
                # Try to parse as JSON
                try:
                    data = json.loads(line_str)
                    self._handle_json_message(data)
                except json.JSONDecodeError:
                    # Not JSON, treat as regular log (probably from old logger with ANSI codes)
                    # Strip ANSI color codes
                    import re
                    clean_line = re.sub(r'\x1b\[[0-9;]*m', '', line_str)
                    if clean_line:
                        self.log_received.emit({
                            'level': 'info',
                            'message': clean_line,
                            'timestamp': ''
                        })
            
            # Wait for process to complete
            self.process.wait()
            
            # Check exit code
            if self.process.returncode == 0:
                self.command_completed.emit(True, 'Command completed successfully')
            else:
                # Read stderr for error message
                stderr = self.process.stderr.read().decode('utf-8', errors='replace')
                self.command_completed.emit(False, f'Command failed: {stderr}')
                
        except Exception as e:
            self.command_completed.emit(False, f'Error running command: {str(e)}')
        
        finally:
            self.is_running = False
            self.process = None
    
    def _handle_json_message(self, data):
        """Handle a parsed JSON message from Node"""
        msg_type = data.get('type')
        
        if msg_type == 'log':
            # Log message
            self.log_received.emit({
                'level': data.get('level', 'info'),
                'message': data.get('message', ''),
                'timestamp': data.get('timestamp', '')
            })
        
        elif msg_type == 'progress':
            # Progress update
            value = data.get('value', 0)
            step = data.get('step', '')
            self.progress_updated.emit(value, step)
        
        elif msg_type == 'video_status':
            # Video status change
            video = data.get('video', '')
            status = data.get('status', '')
            self.video_status_changed.emit(video, status)
        
        elif msg_type == 'success':
            # Success message
            message = data.get('message', 'Success')
            self.log_received.emit({
                'level': 'success',
                'message': message,
                'timestamp': data.get('timestamp', '')
            })
        
        elif msg_type == 'error':
            # Error message
            message = data.get('message', 'Error')
            self.log_received.emit({
                'level': 'error',
                'message': message,
                'timestamp': data.get('timestamp', '')
            })
    
    def stop(self):
        """Stop the currently running process"""
        if self.process and self.is_running:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            
            self.is_running = False
            self.log_received.emit({
                'level': 'warn',
                'message': 'Process stopped by user',
                'timestamp': ''
            })
            return True
        return False
