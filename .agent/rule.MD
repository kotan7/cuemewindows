# Agent System Rules
We keep all important docs in .agent folder and keep updating them
We should always update .agent docs after we implement certain feature, to make sure it fully reflect the up to date information (mark the related files as you do this)
Before you plan any implementation, always read the .agent/README.md first to get context
IMPORTANT: DO NOT create summary docs after implementation unless you are asked to do so explicitly. Conclude everything within the initial task doc assigned.

## Folder Structure

### `/SOP` - Standard Operating Procedures
Process documentation, common mistakes, and workflow guidelines. Read when you need to understand how to execute recurring tasks or avoid known pitfalls.

### `/system` - Technical Architecture
Project structure, database schemas, API contracts, tech stack details. Read when you need to understand how the codebase is organized or make architectural decisions.

### `/task` - Feature Implementation Tracking
Each task gets ONE file that tracks: requirements, plan, progress, and completion notes. Create new files for new features, update existing ones as you work.

## Task File Convention
- Filename: `FEATURE_NAME.md` (e.g., `VIDEO_UPLOAD.md`, `TIKTOK_INTEGRATION.md`)
- Content: Requirements → Plan → Implementation Log → Completion Status
- Update the same file throughout the feature lifecycle
- Archive completed tasks by prefixing with `DONE_`