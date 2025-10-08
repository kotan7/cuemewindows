#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to process
const files = [
  'electron/AdaptiveAudioChunker.ts',
  'electron/AdaptiveQualityManager.ts', 
  'electron/AudioStreamProcessor.ts',
  'electron/ConnectionPoolManager.ts',
  'electron/LLMHelper.ts',
  'electron/WorkflowOptimizationManager.ts'
];

// Decorator patterns to disable
const decoratorPatterns = [
  /@measureTime\([^)]+\)/g,
  /@measureMemory\([^)]+\)/g,
  /@measureAudioProcessing\([^)]+\)/g,
  /@measureLLMOperation\([^)]+\)/g,
  /@trackApiCall\([^)]+\)/g,
  /@trackCache\([^)]+\)/g
];

console.log('🔧 Temporarily disabling decorators for build...');

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    decoratorPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, (match) => `  // ${match}`);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Disabled decorators in ${filePath}`);
    }
  }
});

console.log('🎉 Decorator disabling complete!');