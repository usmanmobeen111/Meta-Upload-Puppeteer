"""
Video Scanner
Scans upload folder for videos and determines duration, type, and status
"""

import os
import json
import subprocess
from pathlib import Path

class VideoScanner:
    def __init__(self):
        self.video_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv']
    
    def scan_folder(self, upload_folder):
        """
        Scan upload folder for video folders
        Returns list of video data dictionaries
        """
        if not upload_folder or not os.path.exists(upload_folder):
            return []
        
        video_data_list = []
        
        # Iterate through subdirectories
        for folder_name in os.listdir(upload_folder):
            folder_path = os.path.join(upload_folder, folder_name)
            
            if not os.path.isdir(folder_path):
                continue
            
            # Find video file in folder
            video_file = None
            for file in os.listdir(folder_path):
                ext = os.path.splitext(file)[1].lower()
                if ext in self.video_extensions:
                    video_file = file
                    break
            
            if not video_file:
                continue
            
            video_path = os.path.join(folder_path, video_file)
            
            # Get video duration
            duration_seconds = self.get_video_duration(video_path)
            
            # Determine video type (REEL vs POST)
            if duration_seconds is not None:
                video_type = 'REEL' if duration_seconds < 90 else 'POST'
                duration_formatted = self.format_duration(duration_seconds)
            else:
                video_type = 'UNKNOWN'
                duration_formatted = 'N/A'
            
            # Check if posted
            status = self.check_posted_status(folder_path, video_file)
            
            # Get caption
            caption = self.get_caption(folder_path)
            
            video_data = {
                'folder_name': folder_name,
                'folder_path': folder_path,
                'video_file': video_file,
                'video_path': video_path,
                'duration_seconds': duration_seconds,
                'duration_formatted': duration_formatted,
                'video_type': video_type,
                'status': status,
                'caption': caption
            }
            
            video_data_list.append(video_data)
        
        return video_data_list
    
    def get_video_duration(self, video_path):
        """
        Get video duration in seconds using FFprobe
        Returns None if FFprobe is not available or duration cannot be determined
        """
        try:
            result = subprocess.run(
                [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'format=duration',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    video_path
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            if result.returncode == 0:
                duration_str = result.stdout.strip()
                try:
                    return float(duration_str)
                except ValueError:
                    return None
            else:
                return None
        except FileNotFoundError:
            # FFprobe not installed
            return None
        except Exception as e:
            print(f"Error getting video duration: {e}")
            return None
    
    def format_duration(self, seconds):
        """Format duration as mm:ss"""
        if seconds is None:
            return 'N/A'
        
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
    
    def check_posted_status(self, folder_path, video_file):
        """
        Check if video has been posted
        Returns 'POSTED' or 'UNPOSTED'
        """
        status_path = os.path.join(folder_path, 'Posted', 'status.json')
        
        if os.path.exists(status_path):
            try:
                with open(status_path, 'r', encoding='utf-8') as f:
                    status_data = json.load(f)
                    if status_data.get('posted'):
                        return 'POSTED'
            except Exception as e:
                print(f"Error reading status file: {e}")
        
        return 'UNPOSTED'
    
    def get_caption(self, folder_path):
        """Get caption from caption.txt"""
        caption_path = os.path.join(folder_path, 'caption.txt')
        
        if os.path.exists(caption_path):
            try:
                with open(caption_path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            except Exception as e:
                print(f"Error reading caption: {e}")
        
        return ''
