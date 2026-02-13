/**
 * Progress Reporter
 * Maps workflow steps to progress percentages
 */

class ProgressReporter {
    constructor(jsonLogger) {
        this.logger = jsonLogger;
        
        // Progress mapping for REEL workflow
        this.reelSteps = {
            'start': { progress: 5, label: 'Starting...' },
            'open_adspower': { progress: 10, label: 'Opening AdsPower profile...' },
            'connect_puppeteer': { progress: 20, label: 'Connecting browser...' },
            'open_meta': { progress: 30, label: 'Opening Meta Business Suite...' },
            'click_create_reel': { progress: 35, label: 'Clicking Create Reel...' },
            'click_add_video': { progress: 40, label: 'Opening video uploader...' },
            'upload_video': { progress: 50, label: 'Uploading video file...' },
            'wait_upload': { progress: 70, label: 'Waiting for upload completion...' },
            'paste_caption': { progress: 80, label: 'Adding caption...' },
            'click_next_1': { progress: 85, label: 'Proceeding to next step...' },
            'click_next_2': { progress: 88, label: 'Finalizing...' },
            'click_share': { progress: 92, label: 'Publishing reel...' },
            'confirm_posted': { progress: 100, label: 'Reel posted successfully!' }
        };

        // Progress mapping for POST workflow
        this.postSteps = {
            'start': { progress: 5, label: 'Starting...' },
            'open_adspower': { progress: 10, label: 'Opening AdsPower profile...' },
            'connect_puppeteer': { progress: 20, label: 'Connecting browser...' },
            'open_meta': { progress: 30, label: 'Opening Meta Business Suite...' },
            'click_create_post': { progress: 35, label: 'Clicking Create Post...' },
            'click_add_video_dropdown': { progress: 38, label: 'Opening video menu...' },
            'click_upload_from_computer': { progress: 40, label: 'Selecting upload option...' },
            'upload_video': { progress: 50, label: 'Uploading video file...' },
            'wait_upload': { progress: 70, label: 'Waiting for upload completion...' },
            'fill_caption': { progress: 80, label: 'Adding caption...' },
            'fill_optional': { progress: 85, label: 'Filling optional fields...' },
            'click_publish': { progress: 92, label: 'Publishing post...' },
            'confirm_published': { progress: 100, label: 'Post published successfully!' }
        };

        this.currentWorkflow = 'reel';
    }

    /**
     * Set the workflow type (reel or post)
     */
    setWorkflow(type) {
        this.currentWorkflow = type.toLowerCase();
    }

    /**
     * Report progress for a step
     */
    report(stepKey, customLabel = null) {
        const steps = this.currentWorkflow === 'post' ? this.postSteps : this.reelSteps;
        const step = steps[stepKey];

        if (!step) {
            console.error(`Unknown step: ${stepKey}`);
            return;
        }

        const label = customLabel || step.label;
        this.logger.progress(step.progress, label);
    }

    /**
     * Report custom progress
     */
    reportCustom(progress, label) {
        this.logger.progress(progress, label);
    }

    /**
     * Get progress for a step
     */
    getProgress(stepKey) {
        const steps = this.currentWorkflow === 'post' ? this.postSteps : this.reelSteps;
        const step = steps[stepKey];
        return step ? step.progress : 0;
    }
}

module.exports = ProgressReporter;
